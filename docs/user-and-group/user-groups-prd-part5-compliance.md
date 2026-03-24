# User & Groups Service — PRD Part 5: Compliance & Board Integration

> **DPDP Act 2023 consent management, UDISE+ data fields, CBSE/BSEH/RBSE board-specific requirements, data export formats, and regulatory identifier specifications.**

---

## 1. DPDP Act 2023 Compliance

### 1.1 Why This Cannot Be Deferred

The Digital Personal Data Protection Act, 2023 defines a child as **any person under 18 years**. Every student in a K-12 school is a child under this law. The DPDP Rules 2025 (Rule 10) require **verifiable parental consent before processing any child's personal data**. Penalties reach **₹200 crore** for children's data violations and **₹250 crore** for other breaches.

**Full compliance deadline: May 13, 2027.** Consent infrastructure must ship with the initial release.

### 1.2 What Requires Consent

| Purpose | Consent Required? | Can Be Bundled? | Exemption Notes |
|---|---|---|---|
| Academic data processing (grades, attendance, enrollment) | **Exempt** (Fourth Schedule) | N/A | Educational institution exemption for core academic functions |
| Safety monitoring within premises (CCTV, gate) | **Exempt** | N/A | Child safety exemption |
| Transport tracking during commute | **Exempt** | N/A | Child safety exemption |
| Board exam registration (sharing with CBSE/BSEH/RBSE) | **Exempt** | N/A | Regulatory compliance |
| WhatsApp communication to parents | **Yes** | No | Not a core academic function |
| SMS alerts to parents | **Yes** | No | Same |
| Photo/video for marketing (website, brochure, social media) | **Yes** | No | Must be separate, specific consent |
| Aadhaar collection and storage | **Yes** | No | Sensitive data — separate consent |
| Sharing with third-party EdTech tools | **Yes** | No | Cross-entity data sharing |
| Biometric collection (fingerprint attendance) | **Yes** | No | Biometric data — highest sensitivity |
| Health data processing (medical records) | **Yes** | No | Health data — separate consent |
| Behavioural tracking/profiling | **Prohibited** | N/A | Section 9(2) — never allowed for children, even with consent |
| Targeted advertising | **Prohibited** | N/A | Section 9(3) — never allowed |

### 1.3 Consent Collection Flow

**During admission (guardian onboarding):**

1. Guardian creates account or is found by phone number.
2. System displays privacy notice (from `privacy_notices` table, in guardian's preferred language).
3. Guardian verifies identity via one of:
   - **School ERP verified account** — guardian already has a verified phone (OTP'd during registration). Acceptable as the school already holds reliable identity information.
   - **Aadhaar OTP** — if guardian provides Aadhaar, verify via UIDAI OTP. Highest assurance.
   - **DigiLocker virtual token** — guardian authenticates via DigiLocker, token stored as `verification_reference`.
   - **In-person ID check** — school admin verifies physical ID (Aadhaar/PAN/Voter ID) and records in system. Guardian signs physical consent form which is scanned and uploaded.
4. System presents consent toggles per purpose (not a single "I agree to everything" checkbox).
5. Guardian grants/denies each purpose individually.
6. Each consent decision creates a row in `consent_records` with verification method, timestamp, IP, user agent.
7. Privacy notice version is linked to the consent record.

**At any later time (consent dashboard):**

1. Guardian logs in → Settings → Privacy & Consent.
2. Sees current consent status per purpose.
3. Can withdraw any consent with one click.
4. Withdrawal creates a new `consent_records` row with `is_granted = false` and `withdrawn_at` timestamp.
5. System must STOP processing data for the withdrawn purpose within 72 hours.
6. Emit `consent.withdrawn` event → downstream services react (e.g., stop sending WhatsApp if WhatsApp consent withdrawn).

### 1.4 Privacy Notice Requirements

Per DPDP Section 5 and Rule 3, the privacy notice must:
- Be standalone and independently understandable (not buried in ToS).
- State the specific personal data being collected.
- State the purpose for each data element.
- Name any third parties data is shared with.
- Explain the right to withdraw consent.
- Provide the Grievance Officer's contact details.
- Be available in **at least English and Hindi** (minimum). Regional languages (Rajasthani, Haryanvi) are recommended.
- Be versioned. When the notice changes, existing consents are NOT automatically invalidated — but new activities must reference the new notice version.

### 1.5 Data Retention Rules

| Data Type | Minimum Retention | Legal Basis | Action on Expiry |
|---|---|---|---|
| Admission Register (AWR entries) | Permanent | CBSE Bye-Law 14.1 | Never delete |
| Transfer Certificate register | Permanent | CBSE circular | Never delete |
| Board exam results | Permanent | Board regulations | Never delete |
| Attendance records | 5 years after student leaves | Institutional practice | Archive (move to cold storage) |
| Fee payment records | 8 years | Financial audit requirements | Archive |
| Medical/health records | 5 years after student leaves | General medical practice | Archive with option to delete on erasure request |
| Marketing photos/videos | Until consent withdrawn | DPDP | Delete within 72 hours of consent withdrawal |
| WhatsApp/SMS logs | 1 year | DPDP minimum | Auto-purge after 1 year |
| Biometric data | Until student leaves | DPDP | Delete within 30 days of leaving |
| Application form data (not admitted) | 1 year after rejection/expiry | DPDP | Auto-purge |
| Enquiry data | 2 years | Marketing/CRM practice | Auto-purge or anonymize |

### 1.6 Right to Erasure Implementation

When a guardian requests erasure:
1. Identify all data for their children at the requesting institute.
2. Classify data as **legally required** (AWR, TC, board results, fee records) or **deletable** (photos, WhatsApp logs, biometric, marketing).
3. For legally required data: **refuse erasure** with written explanation citing the specific law/regulation. DPDP Section 17 provides exemption for data required by law.
4. For deletable data: execute deletion via Temporal workflow (`DataErasureWorkflow`):
   a. Delete marketing photos from S3.
   b. Remove WhatsApp/SMS logs.
   c. Delete biometric data.
   d. Anonymize enquiry/application data (replace PII with placeholders).
   e. Revoke active sessions.
   f. Anonymize audit log entries for deleted data (replace names with "ANONYMIZED").
5. Respond to guardian within **90 days** (DPDP grievance resolution timeline).
6. Log the erasure action in audit trail (what was deleted, what was retained with reason).

### 1.7 Grievance Redressal

Every institute using Roviq must designate a Grievance Officer (not a full DPO — that's only for Significant Data Fiduciaries). The system provides:
- Configurable Grievance Officer name and contact in `institute_configs`.
- Grievance Officer contact displayed on the privacy notice.
- In-app grievance submission form for guardians.
- 90-day resolution tracking.

---

## 2. UDISE+ Data Fields

### 2.1 Student Fields Required for UDISE+ DCF

These fields MUST be populated in Roviq for any school that reports to UDISE+:

| UDISE+ Field | Roviq Source | Section |
|---|---|---|
| Student Name | `user_profiles.first_name + last_name` | GP (General Profile) |
| Father's Name | via `student_guardian_links` + guardian's `user_profiles` | GP |
| Mother's Name | Same | GP |
| Date of Birth | `user_profiles.date_of_birth` | GP |
| Gender | `user_profiles.gender` | GP |
| Aadhaar Number | `user_identifiers(type=aadhaar).value_masked` (masked) | GP |
| Mother Tongue | `user_profiles.mother_tongue` | GP |
| Social Category | `student_profiles.social_category` | EP (Enrollment Profile) |
| Minority Status | `student_profiles.minority_type` | EP |
| Is BPL | `student_profiles.is_bpl` | EP |
| Is CWSN | `student_profiles.is_cwsn` | EP |
| CWSN Type | `student_profiles.cwsn_type` | EP |
| Is RTE Admitted | `student_profiles.is_rte_admitted` | EP |
| Class | `student_academics.standard` → Standard name | EP |
| Section | `student_academics.section` → Section name | EP |
| Admission Number | `student_profiles.admission_number` | EP |
| Stream (Class 11-12) | `student_profiles.stream` | EP |
| Medium of Instruction | From section config | EP |
| Previous Year Status | Computed from prior `student_academics` | EP |
| APAAR ID | `user_identifiers(type=apaar).value_plain` | GP |
| PEN | `user_identifiers(type=pen).value_plain` | GP |

### 2.2 Teacher Fields Required for UDISE+ DCF

| UDISE+ Field | Roviq Source |
|---|---|
| Teacher Name | `user_profiles.first_name + last_name` |
| Aadhaar Number | `user_identifiers(type=aadhaar).value_masked` |
| Date of Birth | `user_profiles.date_of_birth` |
| Gender | `user_profiles.gender` |
| Social Category | (Would need to add to staff_profiles — currently not there. **Add field.**) |
| Nature of Appointment | `staff_profiles.nature_of_appointment` |
| Date of Joining | `staff_profiles.date_of_joining` |
| Academic Qualification | `staff_qualifications(type=academic)` — highest degree |
| Professional Qualification | `staff_qualifications(type=professional)` — B.Ed, D.El.Ed, etc. |
| Trained for CWSN | `staff_profiles.trained_for_cwsn` |
| Disability | Would need to add `is_disabled` + `disability_type` to staff_profiles. **Add fields.** |
| Current Post Held | `staff_profiles.designation` mapped to UDISE+ codes |

**Missing fields to add to `staff_profiles`:**
- `social_category VARCHAR(10)` — same enum as student_profiles
- `is_disabled BOOLEAN DEFAULT false`
- `disability_type VARCHAR(60)` — same RPWD Act categories as student CWSN

### 2.3 UDISE+ DCF Export

The system generates a report matching the UDISE+ Data Capture Format. This is NOT a live API integration (UDISE+ has no public API). It's an Excel/CSV export that school staff manually upload to the UDISE+ portal.

Export includes:
- Section 1: School profile (from Institute Service entities)
- Section 2: Enrollment by class/gender/category (aggregated from student_academics + student_profiles)
- Section 3: Teacher details (from staff_profiles + staff_qualifications)
- Student-level data: GP, EP, SF fields per student

**Implementation:** A report generator Temporal workflow that:
1. Queries all required data via `withTenant()`.
2. Maps Roviq fields to UDISE+ field codes.
3. Generates an XLSX file using SheetJS.
4. Stores in S3 and notifies admin.

---

## 3. CBSE-Specific Requirements

### 3.1 Class 9/11 Registration (Pariksha Sangam)

CBSE requires schools to register Class 9 and Class 11 students at the start of the academic year. The registration data is submitted via the Pariksha Sangam portal.

**Required fields per student:**
- Full Name (capitals, no abbreviations)
- Mother's Name
- Father's/Guardian's Name
- Date of Birth (DD/MM/YYYY)
- Gender
- APAAR ID (12-digit; `"REFUSED"` if parent denied consent; `"NOGEN"` for technical failure)
- Subject Code 1 through Subject Code 7 (3-digit CBSE subject codes)
- CWSN status (disability type if applicable)
- Mobile Number (10-digit)
- Email
- Annual Income (guardian)
- Photograph (JPG, max 40 KB, passport-size)

**Export format:** Excel template matching CBSE's prescribed format. The system generates this from student + guardian + academic + identifier data.

### 3.2 Class 10/12 LOC (List of Candidates)

Submitted for board exam candidates. Built on top of Class 9/11 registration data with additional fields:
- Registration Number (from Class 9/11 registration — must be stored)
- All registered subject codes
- Photo (1500×1200 pixels for batch-scanned sheets)
- Updated APAAR ID status

**Key rule:** Once LOC is submitted, students cannot change subjects. The system should enforce a "LOC submitted" flag that locks subject changes.

### 3.3 CBSE Subject Code Structure

Subject codes are 3-digit numeric:
- 0XX: Core academic (e.g., 041 = Mathematics Standard, 042 = Physics)
- 1XX: Communicative languages (e.g., 101 = English Communicative, 184 = English Lang & Lit)
- 2XX: Basic/applied variants (e.g., 241 = Mathematics Basic)
- 3XX: Class 11-12 core (e.g., 301 = English Core, 302 = Hindi Core)
- 4XX: Class 9-10 skill subjects (e.g., 402 = IT, 417 = AI)
- 8XX: Class 11-12 skill subjects

**Data model:** `subjects.board_code` (VARCHAR(3)) stores the CBSE code. Subject seeding during institute setup populates these from a board catalog config file.

### 3.4 CBSE Transfer Certificate Format

20 numbered fields (detailed in Part 3 §5.2). Additional CBSE-specific header fields:
- Affiliation Number (from `institute_identifiers(type=cbse_affiliation)`)
- School Code (from `institute_identifiers(type=cbse_school_code)`)
- TC Book Number + S.R. Number
- Registration Number (for Class 9-12 students)

---

## 4. Haryana BSEH-Specific Requirements

### 4.1 Student Identifiers

| Identifier | Description | Storage |
|---|---|---|
| BSEH Enrollment Number | Assigned at Class 9 registration | `user_identifiers(type=bseh_enrollment)` |
| SRN (Student Registration Number) | State MIS Portal student ID | `user_identifiers(type=shala_darpan_id)` — reusing for state ID |
| Parivar Pehchan Patra (PPP) | 8-digit Haryana family ID | `user_identifiers(type=parivar_pehchan_patra)` |

### 4.2 BSEH Board Exam Levels

BSEH holds board exams at **Classes 8, 10, and 12** (CBSE only at 10 and 12). The `standards.is_board_exam_class` flag must be set correctly for BSEH-affiliated institutes: Classes 8, 10, 12 = true.

### 4.3 BSEH TC (School Leaving Certificate)

Haryana calls it SLC (School Leaving Certificate), not TC. The format is similar to CBSE with additional fields:
- BSEH Enrollment Number
- PPP ID
- Haryana Domicile status (Yes/No)
- Additional field: "Whether the student availed benefit of free education under RTE"

For inter-district transfers within Haryana, the SLC requires counter-signature by the DEO (District Education Officer).

### 4.4 Haryana MIS Portal Integration

Government schools in Haryana use the OneSchool Suite MIS Portal. Roviq stores the student's SRN (MIS Portal student ID) in `user_identifiers`. Data export for the MIS Portal is a manual Excel upload (no API integration in v1).

---

## 5. Rajasthan RBSE-Specific Requirements

### 5.1 Student Identifiers

| Identifier | Description | Storage |
|---|---|---|
| Shala Darpan ID | NIC-SD student identifier | `user_identifiers(type=shala_darpan_id)` |
| Jan Aadhaar | Rajasthan family ID | `user_identifiers(type=jan_aadhaar)` |
| RBSE Registration Number | Board registration at Class 9 | `user_identifiers(type=rbse_registration)` |

### 5.2 RBSE Board Exam Levels

RBSE holds board exams at **Classes 5, 8, 10, and 12** (more levels than CBSE or BSEH). The `standards.is_board_exam_class` flag for RBSE: Classes 5, 8, 10, 12 = true.

### 5.3 RBSE Registration Data

Registration at `rajeduboard.rajasthan.gov.in` requires student details in **both Hindi and English**. This means:
- `user_profiles` should support a `first_name_local` and `last_name_local` (NULLABLE VARCHAR, for Hindi/regional name).
- Or store in `user_profiles.metadata` JSONB: `{ "name_hindi": "राज कुमार" }`.
- **Decision:** Add `name_local` VARCHAR(200) to `user_profiles`. Single field for the full name in regional script. Simpler than separate first/last.

### 5.4 Shala Darpan Data Export

Rajasthan government schools use Shala Darpan for all student and teacher data. Private schools may also need to report. Export format: CSV with fields matching Shala Darpan's import template.

---

## 6. Migration Certificate

### 6.1 When Required

A Migration Certificate is issued by the **board** (not the school) when a student:
- Changes boards (CBSE → State Board or vice versa)
- Moves to a different state for higher education
- Takes admission in a university after Class 12

The **school** does NOT issue migration certificates. The school issues a TC, and the student applies to the board for a migration certificate using the TC.

### 6.2 Roviq's Role

Roviq stores migration certificate details as a reference (not the actual certificate):
- `user_identifiers(type=migration_certificate)` with `value_plain = certificate_number`, `issuing_authority = 'CBSE'`, `valid_from = issue_date`.
- Used during lateral entry admission: if a student arrives with a migration certificate, the admin records it alongside the incoming TC.

---

## 7. Disability Categories (RPWD Act 2016)

The `cwsn_type` and `disability_type` fields must support these 21 categories:

```
blindness, low_vision, leprosy_cured, hearing_impairment, locomotor_disability,
dwarfism, intellectual_disability, mental_illness, autism_spectrum_disorder,
cerebral_palsy, muscular_dystrophy, chronic_neurological_condition,
specific_learning_disability, multiple_sclerosis, speech_language_disability,
thalassemia, hemophilia, sickle_cell_disease, multiple_disabilities,
acid_attack_victim, parkinsons_disease
```

Stored as VARCHAR (not enum — new categories may be added by future amendments). Validated at application level against the allowed list.

---

## 8. Data Export Summary

| Export | Format | Trigger | Fields |
|---|---|---|---|
| UDISE+ DCF | XLSX | Manual (admin clicks "Export") | School profile + enrollment + teacher data |
| CBSE Registration (Class 9/11) | XLSX (CBSE template) | Annual (September) | Student name, parents, DOB, gender, APAAR, subjects, photo |
| CBSE LOC (Class 10/12) | XLSX (CBSE template) | Annual (September-October) | Registration number + above + updated info |
| BSEH Staff Statement | XLSX | Annual (before board exams) | Teacher details for exam duties |
| Shala Darpan (Rajasthan) | CSV | As needed | Student + teacher data per Shala Darpan template |
| RTE Enrollment Report | XLSX | Quarterly | RTE students count by class, fee reimbursement amounts |
| TC Register | PDF | On demand | All TCs issued in academic year |
| Admission Register (AWR) | PDF | On demand | All admissions in academic year |

All exports are generated as Temporal activities and stored in S3 with a download link sent via Novu.

---

## 9. Testing Strategy for Compliance

### 9.1 Mandatory CI Tests

| # | Test | Assert |
|---|---|---|
| 1 | Aadhaar stored encrypted, never in plaintext | Query `user_identifiers` where `type='aadhaar'` → `value_encrypted IS NOT NULL AND value_plain IS NULL` |
| 2 | Aadhaar display shows only last 4 digits | GraphQL query returns `"XXXX-XXXX-4532"`, never full number |
| 3 | Consent must exist before student profile creation | Create student without guardian consent → error |
| 4 | Consent withdrawal stops WhatsApp | Withdraw WhatsApp consent → send notification → assert not delivered |
| 5 | Privacy notice linked to consent | Every consent_record has non-null privacy_notice_id |
| 6 | Erasure preserves legally required data | Request erasure → AWR entry still exists, photos deleted |
| 7 | TC contains all 20 CBSE fields | Generate TC → validate all fields populated in tc_data JSONB |
| 8 | TC serial number is unique per tenant | Generate two TCs → different serial numbers |
| 9 | TC blocks when dues unpaid | Request TC with unpaid fees → clearance denied |
| 10 | Admission number is unique per tenant | Create two students → different admission numbers |
| 11 | Admission number race condition | Concurrent creates → no duplicate numbers (test with parallel requests) |
| 12 | Guardian deletion blocked if only guardian | Delete last guardian → error `LAST_GUARDIAN_CANNOT_BE_DELETED` |
| 13 | RLS prevents cross-tenant data access | Tenant A student → query as Tenant B → 0 rows |
| 14 | Counselor notes invisible to principal | Login as principal → query counseling sessions → 0 rows |
| 15 | Student cannot see other students' data | Login as student → query all students → only own data returned |
| 16 | Bot API key never stored in plaintext | Query bot_profiles → api_key_hash is argon2 hash |
| 17 | Expired offer auto-lapses | Create offer → wait past deadline → status = 'expired' |
| 18 | Pre-primary admission number has prefix | Create nursery student → admission_number starts with 'N-' |
| 19 | UDISE+ export has all required fields | Generate export → validate all UDISE+ DCF fields present |
| 20 | Staff social_category field exists for UDISE+ | Query staff_profiles → social_category column exists |

---

## 10. Open Questions

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Should `user_profiles.name_local` store the full regional name or separate first/last? | A) Single `name_local` VARCHAR. B) `first_name_local` + `last_name_local`. | A — Simpler. Regional names don't always split cleanly into first/last. |
| 2 | Should consent be collected at institute level or platform level? | A) Per institute (each institute collects separately). B) Platform (one consent covers all institutes). | A — Each institute is a separate Data Fiduciary with its own privacy notice. |
| 3 | Should the group rule engine support custom dimensions (beyond the built-in list)? | A) Fixed dimensions only. B) Allow custom JSONB fields as dimensions. | A for v1 — Fixed dimensions cover 95% of use cases. Custom dimensions add complexity to the SQL generator. |
| 4 | Should coaching institutes use the same admission workflow as schools? | A) Same workflow, different defaults. B) Simplified workflow. | A — Same workflow with coaching-specific defaults (no TC requirement for entry, no board registration). |
| 5 | Should we support offline/paper-based consent for schools in rural areas with low digital literacy? | A) Digital only. B) Support scanned physical consent forms. | B — Add `signed_form_uploaded` as a verification method. School admin uploads scanned signed form. Pragmatic for Indian market. |
