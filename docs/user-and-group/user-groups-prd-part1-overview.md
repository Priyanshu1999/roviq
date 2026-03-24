# User & Groups Service — PRD Part 1: Overview & Architecture

> **Identity management, domain profiles, admission lifecycle, groups, and compliance for Roviq's multi-tenant education SaaS.**
> Platform-level users, tenant-scoped memberships with profiles, Drizzle v1 with native RLS, CASL authorization, DPDP Act 2023 consent infrastructure.

| Field | Value |
|---|---|
| **Status** | Draft |
| **Author** | Priyanshu |
| **Project** | Core Platform |
| **Priority** | P0 — Second Core Module (after Institute Service) |
| **Date** | 24 March 2026 |
| **Version** | 1.0 |

**Classification:** Core Business Module. The User & Groups Service manages every human and bot identity in Roviq. It owns profiles (the domain-specific data that hangs off memberships), the admission lifecycle, student-guardian linkage, Transfer Certificates, school-issued certificates, dynamic groups, and DPDP consent records. Without this module, no user can do anything beyond authenticate.

**Depends on:**
- Auth & Authorization PRD v3.0 (users table, memberships table, roles table, login flow, tokens, impersonation, CASL AbilityFactory)
- Institute Service PRD v3.1 (institutes, standards, sections, subjects, academic years)
- Audit Logging PRD v2.0 (audit interceptor, audit events)

**PRD Structure:**
- **Part 1** (this file): Overview, bounded context, architecture, key decisions
- **Part 2**: Data model — all tables, fields, constraints, RLS policies
- **Part 3**: User lifecycle — admission, enrollment, TC, certificates, status machines
- **Part 4**: Groups & authorization — group types, dynamic rules, CASL role-permission matrix, bots
- **Part 5**: Compliance & board integration — DPDP consent, UDISE+ fields, CBSE/BSEH/RBSE exports

---

## 1. Strategic Context

### 1.1 What This Module Is

The User & Groups Service owns seven aggregates:

1. **User Profile** — personal information, contact details, identity documents, addresses. Extends the platform-level `users` entity (owned by Auth) with domain-specific data.
2. **Student Profile** — academic enrollment, admission details, regulatory identifiers (Aadhaar, APAAR, PEN), social category, guardian linkage. Hangs off an institute membership.
3. **Staff Profile** — employment details, qualifications, teaching assignments, board identifiers. Hangs off an institute membership.
4. **Guardian Profile** — relationship to students, occupation, income (for RTE). Hangs off an institute membership.
5. **Bot Profile** — automated user accounts for notifications, AI chat, system operations. Hangs off an institute membership.
6. **Group** — dynamic and static user groupings for notification targeting, fee assignment, exam grouping, and permission scoping.
7. **Admission** — the full enquiry-to-enrollment pipeline including Transfer Certificates and school-issued certificates.

### 1.2 What This Module Does NOT Own

| Entity | Owner | This Module's Relationship |
|---|---|---|
| `users` table (identity) | Auth Service | Reads. Never writes directly. Calls Auth Service for user creation. |
| `memberships` table | Auth Service | Reads. Requests membership creation via Auth Service during admission. |
| `roles` table | Auth Service | Reads for CASL ability compilation. Seeds default roles during institute setup. |
| `institutes` table | Institute Service | References via `tenant_id` FK. |
| `standards`, `sections`, `subjects` | Institute Service | References for student academic placement. |
| `academic_years` | Institute Service | References for session-scoped data. |
| Attendance, timetable, fees | Downstream services | Publishes events they consume. |
| Enrollment (section assignment, promotion) | Enrollment Service (future) | v1: handled within this module. v2: extracted to dedicated service. |

### 1.3 Relationship to Auth PRD

The Auth PRD (v3.0) defines:
- `users` — platform-level identity (username, email, password_hash, is_active)
- `memberships` — institute-scoped junction `(user_id, tenant_id, role_id, abilities)`
- `roles` — tenant-scoped role definitions with CASL abilities
- `platform_memberships`, `reseller_memberships` — non-institute scope memberships
- Login flow, tokens, impersonation, sessions

**This module extends the auth layer with domain profiles.** When a student is admitted, the flow is:
1. Auth Service creates or finds the `users` row (platform identity)
2. Auth Service creates a `memberships` row (institute-scoped, with student role)
3. **This module** creates the `student_profiles` row (domain data: admission number, DOB, category, guardian links)
4. **This module** creates `student_academics` row (section placement for current year)

The boundary is clean: Auth owns identity + access. This module owns domain data + lifecycle.

### 1.4 Critical Auth PRD Amendment

The Auth PRD defines `CONSTRAINT uq_membership_user_tenant UNIQUE (user_id, tenant_id)` on the `memberships` table. This prevents a user from having two memberships at the same institute.

**This constraint must change to `UNIQUE (user_id, tenant_id, role_id)`** to support:
- A parent who is also a teacher at the same institute (two memberships: one with teacher role, one with guardian role, each with its own profile)
- A principal who is also a parent (institute_admin role + guardian role)

Each membership gets its own profile. The user selects which membership/role to use after logging in.

---

## 2. Bounded Context

### 2.1 Context Map

```
Auth Service ←── [Partnership] ── User & Groups Service
  (users, memberships,                    │
   roles, tokens,                         │
   impersonation)                         │
                                          │
Institute Service ←── [Consumer] ────────┤
  (institutes, standards,                 │
   sections, subjects,                    │
   academic_years)                        │
                                          │
                                    User & Groups Service
                                          │
                                          ├── [Published Language] → Attendance Service
                                          ├── [Published Language] → Finance Service
                                          ├── [Published Language] → Notification Service (Novu)
                                          ├── [Published Language] → Timetable Service
                                          └── [Anti-Corruption Layer] → External Portals
                                               (UDISE+ SDMS, CBSE Pariksha Sangam,
                                                BSEH MIS, Rajasthan Shala Darpan)
```

**Partnership with Auth Service:** Both services must agree on the membership schema. User & Groups requests Auth Service to create users and memberships via NATS. Auth Service never writes profiles — that's this module's domain.

**Consumer of Institute Service:** References standards, sections, subjects, and academic years but never writes to them. Listens to `academic_year.activated`, `section.deleted`, `standard.deleted` events to cascade updates.

### 2.2 Ubiquitous Language

| Term | Definition |
|---|---|
| **User** | A platform-level identity. One human = one user. Owned by Auth Service. |
| **Membership** | A user's access to a specific institute with a specific role. Owned by Auth Service. |
| **Profile** | Domain-specific data attached to a membership. Owned by this module. A student membership has a student_profile. A teacher membership has a staff_profile. |
| **Student Academic** | A student's placement (standard, section, roll number, house) for a specific academic year. One row per student per year. |
| **Guardian Link** | A relationship between a student profile and a guardian profile (father, mother, legal_guardian, etc.) with a primary contact flag. |
| **Admission** | The process of creating a new student membership + profile. Includes enquiry, application, document verification, fee payment, and enrollment. |
| **Enrollment** | The act of placing a student in a specific section for an academic year. Creates a `student_academics` row. |
| **Transfer Certificate (TC)** | A legal document issued when a student leaves. Contains 20+ CBSE-prescribed fields. Marks the student as "left". |
| **Group** | A named collection of users (static list, dynamic rule, or hybrid). Used for notification targeting, fee assignment, exam grouping. |
| **Roviq ID** | The globally unique username for a user (e.g., `raj.2025001`). Owned by Auth Service. |
| **Admission Number** | An institute-assigned sequential number in the Admission-Withdrawal Register. Permanent for the student's career at that institute. |
| **Roll Number** | A section-specific sequential number that resets each academic year. |
| **Bot** | An automated user account for system notifications, AI chat, integrations. Has API key authentication instead of password. |

---

## 3. Architecture Decisions (Already Made)

These decisions are inherited from prior PRDs and past conversations. They are not open for debate.

| Decision | Choice | Source |
|---|---|---|
| Users are platform-level | Not tenant-scoped. One human = one user across all institutes. | Chat: "Migrating institute management system data" |
| Profiles hang off memberships | Domain attributes (student roll number, teacher department) are on profile tables linked to membership, not to user. | Same chat |
| One user, multiple memberships per institute | `UNIQUE (user_id, tenant_id, role_id)` — parent can be teacher at same institute via two memberships. | Same chat |
| Phone numbers on user entity | Platform-level `phone_numbers` table with `country_code`, `number`, `is_primary`, `is_whatsapp_enabled`. Globally unique `(country_code, number)`. | Same chat |
| ORM | Drizzle v1 with `pgPolicy()` for native RLS definitions. | Auth PRD §19, Migration plan |
| Database wrappers | `withTenant()`, `withReseller()`, `withAdmin()`, `withTrash()` | Auth PRD §3.2 |
| Five PostgreSQL roles | `roviq`, `roviq_pooler`, `roviq_app`, `roviq_reseller`, `roviq_admin` | Auth PRD §2 |
| RLS on all tenant-scoped tables | Three-tier policies: roviq_app (tenant), roviq_reseller (read-only), roviq_admin (all) | Auth PRD §9 |
| CASL authorization | Dynamic roles with DB-stored abilities + per-membership overrides. AbilityFactory compiles at login, cached in Redis. | Auth PRD §5 |
| Notifications | Novu via NotificationPort. Channels configured per-institute per-notification-type. | Notification decisions chat |
| Workflows | Temporal.io for admission pipeline, TC issuance, bulk import, year rollover. | Institute PRD |
| Real-time | graphql-ws with ws-ticket auth. NatsPubSub for subscription delivery. | Auth PRD §10.7, Memory |
| Events | NATS JetStream. Fire-and-forget for audit/notification. Tenant-scoped subjects: `INSTITUTE.{tenantId}.event_name`. | Memory |
| Institute types | school, coaching, library. Same data model, different behavior via type flag. Coaching sections = batches. | Institute PRD §3.1 |
| Entity columns | `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `version` on all entity tables. | Institute PRD §3.10 |
| Soft delete | `deleted_at` timestamp. `withTrash()` for admin access to deleted records. | Auth PRD pattern |
| ID generation | UUID v7 for all primary keys. | Memory (local-first readiness) |

---

## 4. Module Structure

### 4.1 Backend (api-gateway)

```
apps/api-gateway/src/
  institute/                          # Institute scope — InstituteScopeGuard
    user/
      profile.resolver.ts             # myProfile, updateMyProfile
      profile.service.ts
    student/
      student.resolver.ts             # listStudents, createStudent, updateStudent, ...
      student.service.ts
      student-academic.resolver.ts    # enrollment, promotion, section change
      student-academic.service.ts
    staff/
      staff.resolver.ts
      staff.service.ts
    guardian/
      guardian.resolver.ts
      guardian.service.ts
    group/
      group.resolver.ts
      group.service.ts
      group-resolution.service.ts     # Dynamic rule evaluation + caching
    admission/
      enquiry.resolver.ts
      application.resolver.ts
      admission.service.ts            # Orchestrates the admission workflow
    certificate/
      tc.resolver.ts
      certificate.resolver.ts
      certificate.service.ts
    bot/
      bot.resolver.ts
      bot.service.ts

  admin/                              # Platform scope — PlatformScopeGuard
    user/
      admin-user.resolver.ts          # adminListUsers, adminSearchUsers
      admin-user.service.ts

  reseller/                           # Reseller scope — ResellerScopeGuard
    user/
      reseller-user.resolver.ts       # resellerListUsers (read-only)
```

### 4.2 Shared Libraries

```
libs/database/src/schema/
  user-profiles/
    user-profiles.ts                  # user_profiles table (personal info extension)
    student-profiles.ts               # student domain data
    staff-profiles.ts                 # staff domain data
    guardian-profiles.ts              # guardian domain data
    bot-profiles.ts                   # bot domain data
    student-academics.ts              # per-year academic placement
    student-guardian-links.ts         # student ↔ guardian junction
    user-phones.ts                    # phone numbers (platform-level, no RLS)
    user-identifiers.ts              # government IDs (Aadhaar, PAN, APAAR, PEN)
    user-documents.ts                 # uploaded identity documents
    user-addresses.ts                 # permanent, current, emergency addresses
    consent-records.ts                # DPDP parental consent
  groups/
    groups.ts                         # group definitions
    group-members.ts                  # static + cached membership
    group-rules.ts                    # dynamic rule definitions (JsonLogic)
  admission/
    enquiries.ts                      # admission enquiry CRM
    admission-applications.ts         # formal applications
    tc-register.ts                    # Transfer Certificate register
    certificate-templates.ts          # configurable certificate templates
    issued-certificates.ts            # generated certificates
  sequences/
    tenant-sequences.ts               # atomic admission/roll/TC number generation
```

---

## 5. Key Domain Events

### 5.1 Events Published by This Module

| Event | NATS Subject | Payload | Consumers |
|---|---|---|---|
| `student.admitted` | `INSTITUTE.{tenantId}.student.admitted` | `{ studentProfileId, membershipId, standardId, sectionId }` | Notification (welcome), Finance (fee structure), Group cache |
| `student.enrolled` | `INSTITUTE.{tenantId}.student.enrolled` | `{ studentProfileId, academicYearId, sectionId }` | Attendance, Timetable, Group cache |
| `student.section_changed` | `INSTITUTE.{tenantId}.student.section_changed` | `{ studentProfileId, oldSectionId, newSectionId }` | Attendance, Timetable, Group cache |
| `student.promoted` | `INSTITUTE.{tenantId}.student.promoted` | `{ studentProfileId, fromStandardId, toStandardId }` | All academic services, Group cache |
| `student.left` | `INSTITUTE.{tenantId}.student.left` | `{ studentProfileId, reason, tcNumber }` | Finance (final dues), Group cache |
| `staff.joined` | `INSTITUTE.{tenantId}.staff.joined` | `{ staffProfileId, membershipId, department }` | Notification, Timetable |
| `staff.left` | `INSTITUTE.{tenantId}.staff.left` | `{ staffProfileId, reason }` | Timetable, Group cache |
| `guardian.linked` | `INSTITUTE.{tenantId}.guardian.linked` | `{ guardianProfileId, studentProfileId, relation }` | Notification (parent onboarding) |
| `group.rules_updated` | `INSTITUTE.{tenantId}.group.rules_updated` | `{ groupId }` | Group cache invalidation |
| `group.membership_resolved` | `INSTITUTE.{tenantId}.group.membership_resolved` | `{ groupId, memberCount }` | Dashboard (real-time) |
| `tc.issued` | `INSTITUTE.{tenantId}.tc.issued` | `{ tcId, studentProfileId }` | Notification (to parent), UDISE+ sync |
| `certificate.generated` | `INSTITUTE.{tenantId}.certificate.generated` | `{ certificateId, type }` | Notification |
| `consent.given` | `INSTITUTE.{tenantId}.consent.given` | `{ consentId, guardianId, purpose }` | Audit |
| `consent.withdrawn` | `INSTITUTE.{tenantId}.consent.withdrawn` | `{ consentId, guardianId, purpose }` | Audit, dependent services |
| `enquiry.created` | `INSTITUTE.{tenantId}.enquiry.created` | `{ enquiryId, classRequested }` | Dashboard (real-time), Notification (follow-up) |

### 5.2 Events Consumed by This Module

| Event | Source | Action |
|---|---|---|
| `academic_year.activated` | Institute Service | Trigger year-start enrollment for continuing students. Invalidate all dynamic groups. |
| `section.deleted` | Institute Service | Null out `section_id` on affected student_academics. Invalidate section-based groups. |
| `standard.deleted` | Institute Service | Block new enrollments. Invalidate standard-based groups. |
| `institute.config_updated` | Institute Service | Refresh cached admission number format, section strength norms. |

---

## 6. Resolver Naming Convention

Per Auth PRD §16.3 — prefixed operation names per scope group.

### 6.1 Institute Scope (InstituteScopeGuard)

```graphql
# Students
listStudents, getStudent, createStudent, updateStudent, deleteStudent
bulkCreateStudents, updateStudentSection, updateStudentHouse, promoteStudents

# Student Academics
listStudentAcademics, enrollStudent, updateEnrollment

# Staff
listStaff, getStaffMember, createStaffMember, updateStaffMember, deleteStaffMember
bulkCreateStaff, updateStaffRoles, updateTeacherLectures

# Guardians
listGuardians, getGuardian, createGuardian, updateGuardian, deleteGuardian
linkGuardianToStudent, unlinkGuardianFromStudent

# My Profile (self-service)
myProfile, updateMyProfile, updateMyPassword, myChildren (parent), mySessions

# Groups
listGroups, getGroup, createGroup, updateGroup, deleteGroup
resolveGroupMembers, previewGroupRule

# Admission
listEnquiries, createEnquiry, updateEnquiry
listApplications, createApplication, updateApplication, approveApplication, rejectApplication

# Certificates & TC
requestTC, approveTC, issueTC, getTCDetails, listTCs
requestCertificate, issueCertificate, listCertificates

# Bots
listBots, createBot, updateBot, deleteBot, rotateBotApiKey

# Statistics
studentStatistics, staffStatistics, guardianStatistics, admissionStatistics
```

### 6.2 Platform Scope (PlatformScopeGuard)

```graphql
adminListUsers, adminSearchUsers, adminGetUser
adminUserStatistics
```

### 6.3 Reseller Scope (ResellerScopeGuard)

```graphql
resellerListUsers  # read-only across their institutes
```

---

## 7. GraphQL Subscriptions

```graphql
type Subscription {
  # Real-time admission dashboard
  enquiryCreated: Enquiry!
  applicationStatusChanged: ApplicationStatusUpdate!

  # Group membership changes
  groupMembershipResolved(groupId: UUID): GroupResolutionUpdate!

  # Student events (for parent dashboard)
  studentUpdated(studentId: UUID): Student!
}
```

---

## 8. Performance Targets

| Operation | Target | Approach |
|---|---|---|
| List students (paginated, 50/page) | < 100ms | B-tree index on `(tenant_id, academic_year_id, section_id)` |
| Full-text student search | < 150ms | PostgreSQL tsvector + GIN index on `first_name`, `last_name`, `admission_number` |
| Group resolution (2,000 students, "all Class 10 Science girls") | < 500ms | SQL-level resolution via Drizzle where clauses, cached result |
| Bulk student import (500 students) | < 60s | Temporal workflow with batched inserts (50 per batch) |
| TC generation (data population + PDF) | < 5s | Pre-fetched data, Temporal activity for PDF generation |
| Admission number generation | < 10ms | Atomic `UPDATE ... RETURNING` on `tenant_sequences` |

---

## 9. What We're Explicitly Skipping (with "When")

| Feature | Why Not Now | When |
|---|---|---|
| Online public application form | Needs form builder, payment gateway, OTP verification | After core admission workflow is stable |
| APAAR/DigiLocker API integration | APIs poorly documented, frequently change | After launch, when APIs stabilize |
| Board-specific report card templates | High effort, board-specific formatting | Sprint after core academics |
| UDISE+ bulk export | Medium effort, government school focus | Before government school onboarding |
| CBSE LOC Excel export | Medium effort, annual deadline | Before October (LOC deadline) |
| Alumni tracking | Low priority for v1 | When schools request it |
| Hostel management (room allocation, warden profiles) | Separate module | When hostel institutes onboard |
| Transport management (route assignment, GPS) | Separate module | When transport module is built |
| Student promotion/year rollover | Complex workflow, depends on exam results | Academic Year Rollover PRD |
| House system management | Nice-to-have | After core academics |
| ID card generation | PDF generation with photo + barcode | After profile + photo upload is solid |
| Online fee payment during admission | Finance module dependency | After Finance Service is live |
| NCC/Scout certificate management | External body certificates | When schools request it |
| Student council / prefect election management | Very niche feature | When schools request it |

---

## 10. Decisions Already Made (This Module)

| Decision | Choice | Why |
|---|---|---|
| Profiles on memberships | Student/staff/guardian profiles FK to membership_id | Same user can be teacher at Institute A and parent at Institute B with different profiles |
| Admission number format | Configurable per institute: `{prefix}-{year}-{sequential}`. Pre-primary uses letter prefix (N/L/U/A). | School reported no admission numbers below Class 2. Configurable handles both patterns. |
| Bot users | Keep bot user type for AI chat, system notifications, integrations. Has API key, not password. | Future AI chat requires bot identity for CASL-scoped data access. |
| TC as a workflow | Temporal workflow: application → clearance → generation → approval → issuance | Multi-step approval chain with timeout handling |
| Groups use JsonLogic rules | Rules stored as JSONB, evaluable server-side and client-side | Flexible rule engine without custom DSL |
| Group membership caching | Separate `group_members_cached` table with event-driven invalidation via NATS | Avoids N+1 resolution on every notification send |
| Student-guardian link | Junction table `student_guardian_links` with relation type and primary contact flag | Bidirectional querying, supports multiple guardians, sibling discovery |
| Atomic number generation | `tenant_sequences` table with `UPDATE ... RETURNING` | Eliminates the COUNT+1 race condition from old system |
| DOB as DATE | PostgreSQL DATE type. Never string. | Enables age calculations, date-range queries. Old system stored as string. |
| CASL with Drizzle | Custom `rulesToDrizzleWhere()` bridge (~200 lines). No production `@casl/drizzle` exists. | `@casl/prisma` doesn't work with Drizzle. Community adapter too immature. |
| Aadhaar encryption | AES-256-GCM at application level. Drizzle `customType` for transparent encrypt/decrypt. Separate SHA-256 hash column for lookups. | DPDP Act mandates encryption. Display last 4 digits only. |
| Consent table from Day 1 | `consent_records` table with per-purpose granularity | DPDP Act May 2027 deadline. Retrofitting consent tracking post-launch is a compliance nightmare. |
