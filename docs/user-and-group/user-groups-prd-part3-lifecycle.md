# User & Groups Service — PRD Part 3: User Lifecycle

> **Admission workflow, enrollment, TC issuance, certificates, status machines, bulk operations, and every business rule per user type.**

---

## 1. Student Lifecycle

### 1.1 Status Machine

```
enquiry → applied → documents_submitted → documents_verified → test_scheduled →
test_completed → offer_made → offer_accepted → fee_paid → enrolled

enrolled → promoted → enrolled (next year)
enrolled → detained → enrolled (same year)
enrolled → graduated (Class 12 / final year)
enrolled → transferred_out (TC issued)
enrolled → dropped_out
enrolled → withdrawn (parent-initiated)
enrolled → suspended
enrolled → expelled

dropped_out → re_enrolled
withdrawn → re_enrolled (re-admission)
transferred_out → re_enrolled (re-admission with TC surrender)
suspended → enrolled (reinstated)
```

**Terminal states:** `graduated`, `expelled`. Cannot transition from these.

**`transferred_out`** requires TC to be issued first. Cannot set this status if `tc_issued = false`.

### 1.2 Admission Workflow (Temporal: `StudentAdmissionWorkflow`)

**Input:** `{ tenantId, applicationId }` or `{ tenantId, enquiryData }` for direct admission.
**Timeout:** 72 hours for each pending step.

#### Phase 1: Enquiry (Optional — skip for direct admission)

1. Create `enquiries` row with all captured data.
2. Auto-assign counsellor (round-robin from staff with `front_office` role).
3. Schedule follow-up: Day 1 SMS → Day 3 call → Day 7 reminder.
4. Emit `enquiry.created` event.

#### Phase 2: Application

1. Convert enquiry to `admission_applications` (or create directly).
2. Generate document checklist based on class and admission type:
   - **Pre-primary (Nursery/LKG/UKG):** Birth certificate, Aadhaar (student + parents), photos, address proof.
   - **Class 1:** Same as pre-primary + immunization record.
   - **Class 2–8 (lateral entry):** All above + TC from previous school + last year report card.
   - **Class 9–10:** All above + CBSE Registration number (if CBSE school).
   - **Class 11:** All above + Class 10 board result + stream preference.
   - **RTE admission:** All above + income certificate + caste certificate + BPL card.
3. Track document upload status per checklist item.

#### Phase 3: Verification

1. Admin verifies each uploaded document (checkmark per document).
2. Duplicate check: search by `(student_name + DOB + father_name)` OR Aadhaar hash.
3. TC verification for lateral entry: validate TC serial format, check school code against CBSE/board records if available.
4. Age verification: DOB must meet class-specific age criteria as of cutoff date (configurable, typically March 31 or September 30).

#### Phase 4: Test / Interview (Optional — configurable per class)

1. Schedule test date/time, assign room.
2. Record test score (if written test) and interview score (if interaction).
3. Generate merit rank within the applicant pool for that class.

#### Phase 5: Offer & Acceptance

1. Generate offer with fee details and deadline.
2. Notify parent via WhatsApp + SMS.
3. If offer not accepted within deadline (configurable, default 7 days), mark as `expired` and offer to next on waitlist.
4. Parent accepts → status = `offer_accepted`.

#### Phase 6: Fee Payment & Enrollment

1. Fee payment confirmation (from Finance Service event or manual marking).
2. **Create user + membership + profile:**
   a. Call Auth Service: create or find `users` row (by phone number or Aadhaar).
   b. Call Auth Service: create `memberships` row (tenant_id, role = student).
   c. Create `student_profiles` row with admission number (auto-generated via `tenant_sequences`).
   d. Create `student_academics` row (section assignment, roll number auto-generated).
   e. Create guardian user + membership + profile if new.
   f. Create `student_guardian_links`.
   g. Copy application documents to `user_documents`.
3. Emit `student.admitted` event.
4. Novu notification: welcome SMS + WhatsApp to parent with Roviq ID and login credentials.

### 1.3 Admission Number Rules

**CBSE bye-law:** Admission numbers are sequential in the Admission-Withdrawal Register (AWR), permanent for the student's career at that institute. A returning student resumes their original number.

**Pre-primary handling (configurable per institute):**

| Config Option | Pre-primary Number Format | Class 1+ Format | When |
|---|---|---|---|
| `unified_sequential` | `2025/0001` (same series) | `2025/0002` | Schools that want one continuous register |
| `prefixed_preprimary` | `N-2025/0001` (Nursery), `L-2025/0002` (LKG), `U-2025/0003` (UKG) | `2025/0001` (fresh series from Class 1) | Schools that don't assign "real" admission numbers below Class 1 |
| `prefixed_class1` | Same as above. Class 1: `A-2025/0001` | `2025/0001` from Class 2 | Schools that start proper numbering from Class 2 |

**Configuration stored in:** `institute_configs.admission_number_config`:
```json
{
  "format": "{prefix}{year}/{value:04d}",
  "prefixes": {
    "nursery": "N-", "lkg": "L-", "ukg": "U-",
    "class_1": "",  // or "A-" for schools that prefix Class 1
    "default": ""
  },
  "start_regular_from": "class_1",  // or "class_2"
  "year_format": "academic_start_year"  // 2025 from 2025-2026
}
```

**Roll number rules:**
- Reset each academic year, per section.
- Sequential within section.
- Auto-generated on enrollment.
- Can be manually overridden (some schools use alphabetical order).
- Sequence key: `roll_no:{section_id}:{academic_year_id}`.

### 1.4 Enrollment Rules

1. A student can be enrolled in exactly one section per academic year. `UNIQUE (student_profile_id, academic_year_id)` on `student_academics`.
2. Section capacity check: if `current_strength >= capacity`, emit `section.capacity_warning` but do NOT hard-block. Exceeding `hard_max` requires explicit reason in audit log.
3. Stream must be set for Class 11-12 sections where `stream_applicable = true`.
4. Enrollment in a new academic year (continuing student) clones the previous year's `student_academics` row with the new year, same section (pending promotion decisions).

### 1.5 Section Change Rules

1. Moving a student between sections in the same standard: update `student_academics.section_id`, generate new roll number in the new section.
2. The old roll number is NOT reassigned to another student (gap is permanent for that year).
3. Emit `student.section_changed` event → invalidates section-based groups.
4. Attendance records remain linked to the old section for dates before the change.

### 1.6 Promotion Rules (Year-End)

1. Batch operation via Temporal workflow: `PromotionWorkflow`.
2. Input: list of student IDs + promotion decisions (promoted / detained / graduated).
3. For each promoted student:
   a. Set current year's `promotion_status = 'promoted'`, `promoted_to_standard_id`.
   b. Create new `student_academics` row for next academic year in the next standard (section TBD or auto-assigned).
   c. Generate new roll number.
4. For detained students: create new row in same standard, new roll number.
5. For graduated students (Class 12 or final year): set `academic_status = 'graduated'`.
6. Emit `student.promoted` per student.
7. Mass group cache invalidation after batch completes.

### 1.7 Student Deletion Rules

1. **Soft delete only.** Never hard delete (except DPDP erasure request via separate workflow).
2. A student with active enrollment (current academic year, status = enrolled) cannot be deleted. Must first be withdrawn or transferred.
3. Deleting sets `deleted_at` timestamp. RLS policies filter out deleted records automatically (`WHERE deleted_at IS NULL` in policies).
4. Admin can view deleted students via `withTrash()` wrapper and restore them (clears `deleted_at`).
5. Guardian deletion check: if deleting a guardian who is the ONLY guardian for any student, block deletion.

---

## 2. Staff Lifecycle

### 2.1 Status Machine

```
invited → active (accepted invitation / onboarded)
active → on_leave
active → suspended
active → resigned
active → terminated
on_leave → active (returned)
suspended → active (reinstated)
resigned → active (re-hired — new membership, but can find by phone)
```

### 2.2 Staff Onboarding

1. Admin creates staff membership + profile.
2. Auth Service generates temporary password or sends passkey registration link.
3. Novu notification: welcome SMS with login credentials.
4. First login forces password change.
5. Staff completes profile: qualifications, documents, emergency contact.

### 2.3 Staff-Specific Business Rules

1. `employee_id` must be unique per tenant (partial unique index `WHERE deleted_at IS NULL`).
2. `date_of_joining` must not be in the future.
3. Teaching staff (PGT/TGT/PRT) must have at least one professional qualification (B.Ed/D.El.Ed/equivalent) — warning, not hard block (some schools have untrained teachers under CBSE's remediation period).
4. A staff member can be `is_class_teacher = true` for at most N sections (configurable, default 1 for schools, unlimited for coaching).
5. Staff with active timetable assignments cannot be deleted without first removing those assignments.

---

## 3. Guardian Lifecycle

### 3.1 Status (inherited from membership)

Guardians don't have a separate status machine — their membership status (`active`, `suspended`, `inactive`) controls access.

### 3.2 Guardian-Student Linking Rules

1. Every active student MUST have at least one guardian with `is_primary_contact = true`. Application-level enforcement on student creation and guardian unlinking.
2. Unlinking the last guardian from a student is blocked.
3. Unlinking a primary contact requires simultaneously assigning another guardian as primary.
4. A guardian can be linked to multiple students (siblings). The `student_guardian_links` junction table makes sibling discovery a simple JOIN.
5. Multiple guardians can be linked to one student (father, mother, grandparent, etc.).
6. Relationship types: `father`, `mother`, `legal_guardian`, `grandparent_paternal`, `grandparent_maternal`, `uncle`, `aunt`, `sibling`, `other`.
7. `can_pickup` flag controls school gate authorization.
8. `lives_with` flag is informational (for custody tracking).

### 3.3 Parent Access Revocation (Divorce/Separation)

When a parent's access needs to be revoked (e.g., court order, separation):
1. Set `student_guardian_links.is_primary_contact = false` for the revoked parent.
2. Set membership `abilities` override: `[{ action: "manage", subject: "all", inverted: true }]` — this CASL override denies all access.
3. The membership remains `active` (preserves historical data) but the user cannot access anything.
4. If another parent needs to become primary, update `is_primary_contact`.
5. Log the change in audit with reason.

### 3.4 Parent-Who-Is-Also-Teacher

Handled via dual memberships (Auth PRD amendment §1.4):
- Membership 1: `role = teacher`, staff_profile attached.
- Membership 2: `role = guardian`, guardian_profile attached with student links.
- After login, the user sees both roles and picks which to use. The JWT carries the selected membership's context.

---

## 4. Bot Lifecycle

### 4.1 Status Machine

```
created → active → suspended → deactivated → deleted
```

### 4.2 Bot Creation Rules

1. Only `institute_admin` or `platform_admin` can create bots.
2. Each bot gets a unique API key (`skbot_` prefix + 32 random hex chars). Only the hash is stored.
3. The plain API key is shown ONCE at creation time. If lost, must rotate.
4. Bot names must be unique per tenant.
5. System bots (`is_system_bot = true`) are created during institute setup (Temporal pipeline, Phase 2).

### 4.3 Default System Bots (Seeded During Institute Setup)

| Bot Type | Name | Purpose |
|---|---|---|
| `system_notification` | Roviq System | Platform alerts, system messages |
| `fee_reminder` | Fee Reminder | Scheduled fee due date reminders |
| `attendance_notification` | Attendance Alert | Event-driven: "Your child was marked absent today" |

Additional bots (AI chatbot, homework reminder, etc.) are created manually by the institute admin when those features are activated.

### 4.4 Bot API Key Rotation

Zero-downtime rotation:
1. Generate new API key.
2. Both old and new keys are valid for 7 days (dual-key overlap period).
3. After 7 days, old key is revoked.
4. Emit `bot.key_rotated` event.

### 4.5 Bot CASL Abilities

Bot abilities are set per `bot_type` during creation. They are NOT configurable per bot instance (security: prevent accidental over-permissioning).

| Bot Type | Read | Write | Subjects |
|---|---|---|---|
| `system_notification` | Yes | Notification only | Student, Staff, Guardian (names), Notification |
| `fee_reminder` | Yes | Notification only | Student, Guardian, Fee |
| `attendance_notification` | Yes | Notification only | Student, Guardian, Attendance |
| `ai_chatbot_parent` | Yes (scoped to parent's children) | No | Student, Attendance, Fee, Homework, Exam, Event |
| `ai_chatbot_student` | Yes (own data only) | No | Attendance, Homework, Exam, Timetable, Event |
| `integration` | Yes | Yes (specific subjects) | Configurable per bot |
| `report_generation` | Yes | No | All tenant data |

---

## 5. Transfer Certificate Workflow

### 5.1 TC Issuance (Temporal: `TCIssuanceWorkflow`)

**Input:** `{ tenantId, studentProfileId, reason, requestedBy }`
**Timeout:** 7 days total.

#### Step 1: Request Validation
1. Verify student exists and is in `enrolled` status.
2. Verify requester has `create:TransferCertificate` CASL ability.
3. Create `tc_register` row with `status = 'requested'`.

#### Step 2: Multi-Department Clearance (Parallel)
1. Notify department heads via NATS → Novu:
   - **Accounts:** Check outstanding fee dues. If dues > 0, clearance denied with amount.
   - **Library:** Check unreturned books. If any, clearance denied with book list.
   - **Lab:** Check unreturned equipment.
   - **Transport:** Check transport fee dues.
   - **Hostel:** Check hostel dues (if applicable).
2. Each department clears by updating `tc_register.clearances` JSONB.
3. All departments must clear before proceeding. Timeout: 3 days per department.

#### Step 3: Data Population
1. Auto-populate `tc_data` JSONB from student record:
   - **From `user_profiles`:** Name, DOB.
   - **From `student_profiles`:** Admission number, admission date, social category, caste, nationality, academic_status, stream.
   - **From `student_guardian_links` + `guardian_profiles` + `user_profiles`:** Father's name, mother's name.
   - **From `student_academics`:** Class last studied, standard name, section, roll number.
   - **From `student_academics` (all years):** Full attendance record.
   - **From `user_identifiers`:** Aadhaar (masked), APAAR ID, PEN, registration numbers.
   - **From Institute Service:** Subjects offered (from subject-section mapping).
   - **Computed:** Whether qualified for promotion (from last exam result), NCC/Scout status, total working days, days attended.
2. Snapshot all data into `tc_data` JSONB (immutable snapshot — even if student data changes later, the TC preserves the data at time of generation).

#### Step 4: Review & Approval
1. Class teacher reviews TC data for accuracy.
2. Principal approves (ONLY principal — CBSE bye-law: TC must bear Principal's signature).
3. If Principal is absent, Vice Principal with written delegation can sign — `tc_register.approved_by` records the actual signer.

#### Step 5: Issuance
1. Assign TC serial number via `tenant_sequences` (`tc_no:{academic_year_id}`).
2. Generate PDF with school letterhead, QR code, digital signature.
3. Upload PDF to S3/MinIO.
4. Update student:
   - `student_profiles.tc_issued = true`
   - `student_profiles.tc_number = serial_number`
   - `student_profiles.tc_issued_date = today`
   - `student_profiles.academic_status = 'transferred_out'`
   - `student_profiles.date_of_leaving = today`
5. Mark membership as inactive (Auth Service call).
6. Emit `tc.issued` event.
7. Novu notification to parent: "TC issued for {student_name}. Serial: {serial_number}."

### 5.2 TC Data Fields (CBSE Format — 20 Fields)

| # | Field | Source |
|---|---|---|
| 1 | Name of Pupil + Aadhaar | `user_profiles.first_name + last_name`, `user_identifiers(aadhaar).value_masked` |
| 2 | Mother's Name + Aadhaar | `guardian_profiles` via `student_guardian_links(relationship=mother)` |
| 3 | Father's/Guardian's Name + Aadhaar | Same, `relationship=father` or `legal_guardian` |
| 4 | Nationality | `user_profiles.nationality` |
| 5 | Whether SC/ST/OBC | `student_profiles.social_category` |
| 6 | DOB (figures + words) | `user_profiles.date_of_birth` (auto-formatted) |
| 7 | Whether failed, if so once/twice | Computed from `student_academics.promotion_status` across years |
| 8 | Subjects offered | From `subject_sections` + `subject_standards` for last year |
| 9 | Class last studied | Latest `student_academics.standard` name |
| 10 | Last exam taken with result | From Exam Service (or manual entry if exam module not live) |
| 11 | Whether qualified for promotion | `student_academics.promotion_status` |
| 12 | Whether all dues paid | `tc_register.clearances.accounts.cleared` |
| 13 | Fee concession details | From Finance Service or manual entry |
| 14 | NCC/Scout/Guide details | From `student_academics.class_roles` or manual entry |
| 15 | Date name struck off rolls | `student_profiles.date_of_leaving` |
| 16 | Reason for leaving | `tc_register.reason` |
| 17 | Total working days + days present | Computed from Attendance Service or manual entry |
| 18 | General conduct | Manual entry by class teacher during TC review |
| 19 | Other remarks | Manual entry |
| 20 | Date of issue | `tc_register.issued_at` |

### 5.3 Duplicate TC Rules

1. Parent submits written application with: FIR copy (or lost declaration), affidavit, newspaper publication of TC loss.
2. Admin creates duplicate TC with `is_duplicate = true`, `original_tc_id` referencing the original.
3. New serial number assigned (not the original number).
4. PDF prominently marked "DUPLICATE COPY".
5. Fee for duplicate: configurable per institute (₹200-500 typical).

### 5.4 TC Cancellation

1. Only if student returns BEFORE joining another school.
2. Original TC must be physically surrendered to the school.
3. `tc_register.status = 'cancelled'`.
4. Student is re-admitted with the SAME admission number.
5. `student_profiles.tc_issued = false`, `academic_status = 're_enrolled'`.
6. Membership reactivated.

### 5.5 Counter-Signature Rules

| Transfer Type | Counter-Signature Required? | By Whom |
|---|---|---|
| CBSE → CBSE (same region) | No | — |
| CBSE → CBSE (different region) | No | — |
| CBSE → State Board | No (TC from CBSE is sufficient) | — |
| State Board → CBSE | Yes | Controlling authority of issuing board |
| Foreign school → CBSE | Yes | CBSE Regional Office (eligibility certificate) |
| Inter-district (state board) | Yes (in some states) | DEO of issuing district |

---

## 6. Other Certificates

### 6.1 Character Certificate

**Fields:** Student name, father's name, class/section, period of study (from-to dates), character assessment ("Good/Very Good/Excellent"), purpose, date, Principal's signature.
**Workflow:** Request → Class teacher provides conduct remark → Principal approves → Serial number → Issued.
**Business rule:** Purpose must be specified. Common: "for higher studies", "for scholarship application", "for hostel admission".

### 6.2 Bonafide Certificate

**Fields:** Student name, father's name, class, section, admission number, statement: "This is to certify that {name} is a bonafide student of this school studying in Class {class} Section {section}", purpose, date, Principal's signature + seal.
**Workflow:** Request → Admin generates → Principal approves → Issued.
**Business rule:** Most frequently requested certificate. Must be issuable within 1 working day. Only for currently enrolled students.

### 6.3 Railway Concession Certificate

**Fields:** Student name, class, home station, school station, route (via), railway name, validity period.
**Workflow:** Request → Admin generates → Principal approves → Issued.
**Business rule:** Valid for one academic year. Typically issued in bulk at year start. Requires route details from transport module or manual entry.

### 6.4 No Dues / Fee Payment Certificate

**Fields:** Student name, class, admission number, fee paid (total for year), no outstanding dues statement, date, Accountant's signature + Principal's signature.
**Workflow:** Request → Accounts verifies → Issues.
**Business rule:** Prerequisite for TC issuance. Also requested for bank loan applications (education loan).

### 6.5 Attendance Certificate

**Fields:** Student name, class, section, academic year, total working days, days present, attendance percentage, date, Class teacher's signature + Principal's signature.
**Workflow:** Request → System auto-calculates from attendance data → Class teacher verifies → Issued.

### 6.6 Sports Certificate

**Fields:** Student name, event, level (school/block/district/state/national), position, organizing body, date of event, PE Teacher's signature + Principal's signature.
**Workflow:** Request → PE teacher provides details → Principal approves → Issued.

---

## 7. Bulk Operations

### 7.1 Bulk Student Import (Temporal: `BulkStudentImportWorkflow`)

**Input:** Excel file (XLSX) + tenant_id + academic_year_id + default_standard_id + default_section_id.

**Excel template columns:**
| Column | Required | Validation |
|---|---|---|
| Student First Name | Yes | Non-empty, max 100 chars |
| Student Last Name | No | Max 100 chars |
| Date of Birth | Yes | DATE format (DD/MM/YYYY or YYYY-MM-DD) |
| Gender | Yes | male/female/other |
| Father's Name | Yes | Non-empty |
| Mother's Name | Yes | Non-empty |
| Parent Phone | Yes | 10-digit Indian mobile |
| Parent Email | No | Valid email format |
| Standard | No | Override default. Must match existing standard. |
| Section | No | Override default. Must match existing section. |
| Social Category | No | general/sc/st/obc/ews. Default: general |
| Religion | No | Free text |
| Aadhaar (Student) | No | 12 digits, Verhoeff checksum |
| Aadhaar (Parent) | No | 12 digits |
| Previous School | No | Free text |
| Blood Group | No | A+/A-/B+/B-/AB+/AB-/O+/O- |

**Workflow steps:**
1. Parse Excel (using SheetJS in Temporal activity).
2. Validate each row. Collect errors.
3. Duplicate detection per row: match on `(first_name + DOB + father_name)` or Aadhaar hash.
4. Guardian deduplication: if same parent phone appears on multiple rows, create ONE guardian and link to all students (sibling detection).
5. Insert in batches of 50.
6. For each valid student: create user → membership → profile → academics → guardian link (same flow as individual admission, minus the enquiry/application phases).
7. Generate admission numbers in sequence.
8. Return: `{ total, succeeded, failed, errors: [{ row, field, message }] }`.
9. Emit `student.admitted` per student after batch completes.

### 7.2 Bulk Section Assignment

Move N students to a different section in one operation. Used during section reshuffling at year start.

1. Input: `{ studentIds[], targetSectionId, targetStandardId }`.
2. Validate target section exists and has capacity.
3. Update `student_academics.section_id` for each student.
4. Generate new roll numbers in target section.
5. Emit `student.section_changed` per student.
6. Single group cache invalidation after batch.

### 7.3 Bulk Promotion

Covered in §1.6 above. Temporal workflow processing 50 students per batch.

---

## 8. Self-Service Operations

### 8.1 Parent Self-Service

| Operation | CASL Action | Details |
|---|---|---|
| View own children's profiles | `read:Student` (condition: `id IN childrenIds`) | Includes attendance, marks, timetable, fees |
| Update own profile | `update:Profile` (condition: `userId = self`) | Phone, email, address, profile image |
| Apply for student leave | `create:LeaveRequest` | Routed to class teacher for approval |
| Pay fees online | Redirect to Finance Service payment page | |
| Download certificates | `read:Certificate` (condition: `studentId IN childrenIds`) | PDFs of issued certificates |
| View notifications | — | Novu in-app notification center |
| Message class teacher | `create:Message` | Via in-app messaging (future) or WhatsApp |

### 8.2 Student Self-Service

| Operation | CASL Action | Details |
|---|---|---|
| View own profile | `read:Student` (condition: `id = self`) | Name, photo, class, section |
| View own attendance | `read:Attendance` (condition: `studentId = self`) | |
| View own marks | `read:Exam` (condition: `studentId = self`) | |
| View timetable | `read:Timetable` (condition: `sectionId = mySectionId`) | |
| Submit homework | `create:HomeworkSubmission` | Future module |
| View notices | `read:Notice` | School-wide + class-specific notices |

### 8.3 Staff Self-Service

| Operation | CASL Action | Details |
|---|---|---|
| View/update own profile | `update:Profile` (condition: `userId = self`) | |
| View own attendance | `read:Attendance` (condition: `staffId = self`) | |
| View payslip | `read:Payroll` (condition: `staffId = self`) | Future module |
| Apply for leave | `create:LeaveRequest` | Routed to reporting authority |
| View assigned sections/subjects | `read:Timetable` | |
