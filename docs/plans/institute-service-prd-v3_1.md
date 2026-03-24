# Institute Service — PRD

> **Domain-driven design specification for institute lifecycle, academic structure, and organizational hierarchy in the Roviq multi-tenant education SaaS.**
> Aligned with the three-tier scope model (Platform → Reseller → Institute), five PostgreSQL roles, and Drizzle v1 with native RLS policy definitions.

| Field | Value |
|---|---|
| **Status** | Implemented |
| **Author** | Priyanshu |
| **Project** | Core Platform |
| **Priority** | P0 — Tenant Root Entity |
| **Estimated Effort** | 16–20 hours (with AI agents) |
| **Date** | 20 March 2026 |
| **Version** | 3.1 |

**Classification:** Core Business Module. The institute is the tenant root — every tenant-scoped table has a `tenant_id` FK pointing to `institutes.id`. RLS enforces isolation via `SET LOCAL ROLE roviq_app` + `app.current_tenant_id`. Nothing in Roviq works without this module being right.

**Depends on:** Auth & Authorization PRD v3.0 (three-tier scoping, five DB roles, Drizzle RLS policies, three membership tables, reseller model)

---

## 1. Strategic Context

### 1.1 What This Module Is

The Institute Service owns four aggregates that together define **what an institute is, how it structures its academics, and how it organizes learners**:

1. **Institute** — the tenant itself: identity, branding, configuration, regulatory identifiers, operational status, reseller assignment, optional group membership
2. **Standard** — a class/grade/year level within the institute (Class 5, 11th Science, Nursery)
3. **Section** — a division within a standard where students are grouped (5-A, 11-B Commerce, Batch JEE-2026-Morning)
4. **Subject** — an academic discipline offered at specific standards, optionally linked to sections

It also owns one platform-level entity:

5. **InstituteGroup** — a minimal label entity for organizational grouping (trust/chain). No memberships or operational powers in v1.

### 1.2 Where Institute Sits in the Three-Tier Scope Hierarchy

```
Platform (Roviq)
  └── Reseller (white-label partner — sales/support channel)
        └── InstituteGroup (optional — trust/chain that owns multiple institutes)
              └── Institute (tenant — the RLS boundary)
```

Per the auth PRD:
- Every institute belongs to a reseller. `institutes.reseller_id` is **NOT NULL**. Default: "Roviq Direct" system reseller (`00000000-0000-0000-0000-000000000001`).
- An institute may optionally belong to an institute group. `institutes.group_id` is **NULLABLE**. Groups are minimal in v1 — a label only.
- Platform admin manages infrastructure and resellers. Reseller manages their institutes. Institute admin manages their own institute.

### 1.3 Five PostgreSQL Roles

Per the auth PRD, five roles exist. Two are infrastructure roles (never appear in RLS policies), three are application roles (appear in every policy):

| Role | Type | Purpose |
|---|---|---|
| `roviq` | Infrastructure | Superuser. Migrations only. Never in application code. |
| `roviq_pooler` | Infrastructure | Connection pool role. NOINHERIT. Application connects as this, then `SET LOCAL ROLE` to an application role. If SET LOCAL is omitted, all queries fail with permission denied (safe failure mode). |
| `roviq_app` | Application | Institute-scoped. RLS via `app.current_tenant_id`. |
| `roviq_reseller` | Application | Reseller-scoped. RLS via `app.current_reseller_id`. Read-only on tenant data. |
| `roviq_admin` | Application | Platform-scoped. Does NOT have BYPASSRLS — access via explicit `USING (true)` policies. |

### 1.4 Why This Is Hard

India's education system is extraordinarily fragmented. Roviq must support:

- **Three boards initially** (CBSE, Haryana BSEH, Rajasthan RBSE) with different exam levels, grading systems, subject codes, and reporting portals
- **Two structural frameworks** simultaneously: NEP 2020's 5+3+3+4 and the traditional 10+2
- **Three institute types** with fundamentally different academic structures: schools (standard → section), coaching centers (course → batch), and libraries (simplified flat structure)
- **Three authorization scopes** accessing institute data: platform admin (all institutes), reseller staff (their reseller's institutes), institute users (their own institute)
- **Indian regulatory identifiers** (UDISE+ 11-digit code, CBSE affiliation number, CBSE school code, state board registration, society registration) that vary by board and state

### 1.5 Boards We Support (v1)

| Board | Full Name | Exam Levels | Grading | Academic Year | Key Portal |
|---|---|---|---|---|---|
| CBSE | Central Board of Secondary Education | 10, 12 | 9-point relative (A1–E) | April–March | OASIS, SARAS |
| BSEH | Board of School Education Haryana | 8, 10, 12 | Percentage | April–March | MIS Portal |
| RBSE | Rajasthan Board of Secondary Education | 5, 8, 10, 12 | Percentage | April–March | Shala Darpan |

### 1.6 NEP 2020 vs Traditional Structure

| NEP Stage | Age | Classes | Traditional Equivalent |
|---|---|---|---|
| Foundational | 3–8 | 3 years pre-primary + Class 1–2 | Pre-Primary + Primary (partial) |
| Preparatory | 8–11 | Class 3–5 | Primary (partial) |
| Middle | 11–14 | Class 6–8 | Upper Primary / Secondary (partial) |
| Secondary | 14–18 | Class 9–12 | Secondary + Senior Secondary |

Every standard carries both `level` (traditional) and `nep_stage`. The institute's `structure_framework` flag (`nep` or `traditional`) determines which drives the UI, but both are always populated.

---

## 2. Bounded Context: Institute Service

### 2.1 Domain Boundaries

**Owns (tenant-scoped):**
- Institute aggregate (lifecycle, identity, config, branding, affiliations, reseller/group assignment)
- Academic Year / Session aggregate
- Standard aggregate (class/grade definitions)
- Section aggregate (division/batch within a standard)
- Subject aggregate (academic disciplines, seeded per-institute from board catalog)

**Owns (platform-level — no tenant_id):**
- InstituteGroup entity (minimal v1 — label + FK)

**Does NOT own (consumes or collaborates):**
- Users, authentication, memberships, roles, profiles (Identity Service — per auth PRD)
- Resellers and reseller memberships (Identity Service — per auth PRD Section 7, 4.3)
- Enrollment, transfers, withdrawals, promotions (Enrollment Service)
- Attendance, timetables, fees, notifications, file storage (downstream services)

**Clarification on InstituteGroup ownership:** InstituteGroup sits above the tenant boundary (it groups multiple tenants) and has no `tenant_id`. It is architecturally a platform-level entity, similar to how `resellers` is platform-level. However, unlike resellers (which have their own membership table and scope in the auth PRD), groups have no membership or auth layer in v1. The Institute Service owns it because groups are purely an organizational concept tied to institutes — they have no independent existence. If v2 adds `group_memberships` with their own scope (a fourth scope tier), ownership may migrate to Identity Service.

### 2.2 Context Map

```
Identity Service ←── [Partnership] ── Institute Service
  (users, memberships,                    │
   roles, profiles,                       │
   resellers,                             │
   reseller_memberships)                  │
                                          ├── [Published Language] → Enrollment Service
                                          ├── [Published Language] → Attendance Service
                                          ├── [Published Language] → Finance Service
                                          └── [Anti-Corruption Layer] → External Portals
                                               (OASIS, UDISE+, Shala Darpan, MIS Portal)
```

**Partnership** (not Conformist) with Identity Service because: the Institute setup pipeline requests Identity Service to create users, memberships, and roles. Both services must agree on the membership schema. The Institute Service does not directly write to `memberships`, `users`, or `roles` tables — it calls Identity Service operations via NATS.

### 2.3 Ubiquitous Language

| Term | Definition |
|---|---|
| **Institute** | The tenant entity. A single educational organization. Never "school" in code/UI. |
| **Reseller** | A white-label partner that sells/supports Roviq to institutes. Owned by Identity Service. Institute Service references it via `reseller_id` FK but does not manage it. |
| **InstituteGroup** | An optional organizational grouping (trust/society/chain) that owns multiple institutes. Minimal in v1. |
| **Standard** | A class/grade level (e.g., "Class 5", "Nursery", "11th"). We use "Standard" internally. |
| **Section** | A division within a standard (e.g., "A", "B", "Science"). In coaching: a "Batch". Same entity. |
| **Subject** | An academic discipline (e.g., "Mathematics", "Physics"). Has board-specific codes. |
| **Academic Year** | A fiscal year of academic activity (e.g., "2025-2026"). Exactly one active per institute at any time. |
| **Department** | A grouping of standards by education level (pre_primary through senior_secondary). |
| **Level** | Traditional classification (pre_primary through senior_secondary). |
| **NEP Stage** | NEP 2020 classification (foundational through secondary). |
| **Stream** | Academic specialization at senior secondary (Science PCM, Science PCB, Commerce, Arts). Stored as JSONB on section. |
| **Affiliation** | A regulatory relationship between an institute and a board/authority. |
| **Shift** | A time period during which the institute operates (Morning, Afternoon). |
| **Medium** | Language of instruction. Per-section, not per-institute. |

---

## 3. Aggregate: Institute

### 3.1 Identity & Classification

- **Name** — display name (e.g., "Delhi Public Institute, Mathura Road")
- **Code** — short alphanumeric, unique among non-deleted institutes (e.g., "DPI-MR"). Partial unique index: `WHERE deleted_at IS NULL`.
- **Type** — `school`, `coaching`, `library`. Fundamentally changes academic structure:
  - `school`: Standard → Section hierarchy, board-affiliated, regulatory compliance required
  - `coaching`: Course → Batch (modeled as Standard → Section with coaching-specific fields), multi-enrollment per student, no board affiliation required
  - `library`: Flat structure (single standard "Library", sections for membership types)
- **Structure Framework** — `nep` or `traditional`. Drives UI labels and grouping.
- **Status** — lifecycle state: `pending_approval`, `pending`, `active`, `inactive`, `suspended`, `rejected`
- **Setup Status** — Temporal workflow progress: `pending`, `in_progress`, `completed`, `failed`
- **Is Demo** — boolean, default false. Demo institutes have notifications disabled and get sample data seeded during setup.

### 3.2 Reseller Assignment

Per the auth PRD:

- **Reseller ID** — NOT NULL FK to `resellers.id`. Default: "Roviq Direct" system reseller.
- Institutes created by platform admin are assigned to any reseller the admin chooses.
- Institutes created by reseller staff (full_management tier, with platform approval) are auto-assigned to that reseller.
- When a reseller is deleted (after 30-day suspension grace period per auth PRD Section 13.3), all their institutes transfer to "Roviq Direct" and institute admins are notified.

**Reseller suspension vs institute suspension — two different things:**
- **Reseller suspension** (auth PRD Section 13.2): reseller staff lose access (refresh tokens revoked, impersonation sessions terminated). Institute operations are UNAFFECTED — institute users login via `app.roviq.com` independently. Institutes under a suspended reseller continue working normally.
- **Institute suspension**: the institute itself is suspended. All institute users lose access. This is triggered by platform admin or reseller admin (full_management tier), not by reseller suspension.

### 3.3 InstituteGroup Assignment (Minimal — v1)

- **Group ID** — NULLABLE FK to `institute_groups.id`.
- Purely informational in v1 — a label for grouping institutes in platform/reseller admin UIs.
- An institute can have at most one group. A group can have multiple institutes.
- A group's institutes should all be under the same reseller (application-level enforcement).

### 3.4 Regulatory Identifiers

Stored as a collection of `institute_identifiers` rows:

| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → institutes | RLS-scoped |
| type | VARCHAR | `udise_plus`, `cbse_affiliation`, `cbse_school_code`, `bseh_affiliation`, `rbse_registration`, `society_registration`, `state_recognition`, `shala_darpan_id` |
| value | VARCHAR | The identifier value |
| issuing_authority | VARCHAR | Who issued it (e.g., "CBSE", "Haryana Education Dept") |
| valid_from | DATE | Nullable |
| valid_to | DATE | Nullable |

Supports future boards without schema changes.

### 3.5 Affiliations

An institute can hold multiple affiliations simultaneously.

| Column | Type | Description |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK → institutes | RLS-scoped |
| board | VARCHAR | `cbse`, `bseh`, `rbse`, `icse`, etc. |
| affiliation_status | VARCHAR | `provisional`, `regular`, `extension_pending`, `revoked` |
| affiliation_number | VARCHAR | Board-assigned number |
| granted_level | VARCHAR | `up_to_primary`, `up_to_secondary`, `up_to_senior_secondary` |
| valid_from | DATE | |
| valid_to | DATE | |
| noc_number | VARCHAR | State NOC number |
| noc_date | DATE | |

### 3.6 Contact & Address

**Contact** — stored as JSONB on the institutes table:

```json
{
  "phones": [
    {
      "country_code": "+91",
      "number": "9876543210",
      "is_primary": true,
      "is_whatsapp_enabled": true,
      "label": "Reception"
    },
    {
      "country_code": "+91",
      "number": "9876543211",
      "is_primary": false,
      "is_whatsapp_enabled": false,
      "label": "Principal"
    }
  ],
  "emails": [
    {
      "address": "admin@dpi.edu.in",
      "is_primary": true,
      "label": "Administration"
    }
  ]
}
```

Validation rules:
- At least one phone with `is_primary = true`
- At most one phone with `is_primary = true`
- At least one phone with `is_whatsapp_enabled = true` (WhatsApp is primary parent communication channel)
- `country_code` and `number` stored separately — never concatenated
- Indian numbers: 10 digits, country code +91

**Address** — stored as JSONB on the institutes table:

```json
{
  "line1": "123 Main Road",
  "line2": "Near City Center",
  "line3": null,
  "city": "New Delhi",
  "district": "South Delhi",
  "state": "Delhi",
  "postal_code": "110001",
  "country": "India",
  "coordinates": { "lat": 28.6139, "lng": 77.2090 }
}
```

The `district` field is essential — Indian government reporting (UDISE+, Shala Darpan) groups by district. `coordinates` needed for OASIS geo-tagging compliance.

### 3.7 Branding

Stored in `institute_branding` (one-to-one with institutes):
- Logo URL, Favicon URL, Primary color (hex), Secondary color (hex), Theme identifier, Cover image URL
- Defaults applied during creation if not provided

### 3.8 Configuration

Stored in `institute_configs` (one-to-one with institutes):
- **Attendance type** — `lecture_wise` or `daily`
- **Operating hours** — opening time, closing time (TIME type, not string)
- **Shift configuration** — JSONB array of shifts: `[{ name, start_time, end_time }]`
- **Notification preferences** — JSONB per-event-type channel configuration
- **Payroll configuration** — duty start time, half-day cutoff
- **Grading system** — board-specific configuration (9-point for CBSE, percentage for state boards)
- **Term structure** — JSONB array of terms: `[{ label, start_date, end_date }]`
- **Section strength norms** — JSONB board-level capacity constraints: `{ optimal: 40, hard_max: 45, exemption_allowed: true }`. CBSE mandates 40 optimal with 45 absolute maximum (temporary flexibility through 2025-26). Defense/central govt employee transfers can exceed 45 with documented exemption.

### 3.9 Departments

Stored as a PostgreSQL array column on the institutes table: `departments department[] NOT NULL`.

`department` enum: `pre_primary`, `primary`, `upper_primary`, `secondary`, `senior_secondary`

### 3.10 Tracking Columns

Every tenant-scoped table in the Institute Service follows the `entityColumns` pattern:

- **created_at** — TIMESTAMPTZ, default NOW()
- **created_by** — UUID FK → users. The user who created the record. For setup pipeline operations, this is the user who created the institute (not SYSTEM_ACTOR — the original actor is threaded through from the NATS message headers).
- **updated_at** — TIMESTAMPTZ, auto-updated
- **updated_by** — UUID FK → users. Last modifier.
- **deleted_at** — TIMESTAMPTZ, nullable. Soft delete marker.
- **deleted_by** — UUID FK → users, nullable. Who soft-deleted.
- **version** — INTEGER, default 1. Incremented on every update. Used for optimistic concurrency control — updates include `WHERE version = expected_version`, if 0 rows affected → concurrent modification error (409 Conflict).

### 3.11 Institute Lifecycle

```
                            ┌─── rejected (terminal)
                            │
pending_approval ──→ pending ──→ active ──→ inactive ──→ active (reactivation)
   (reseller-created)  (setup)                              │
                            │                          suspended
                            │                              │
                            └──────────────────────────────┘
```

| Status | Meaning | Who Can Trigger |
|---|---|---|
| `pending_approval` | Reseller-created institute awaiting platform admin approval | Reseller (full_management) creates |
| `pending` | Approved (or platform-admin-created). Temporal setup workflow running. Cannot accept logins. | Platform admin approves, or creates directly |
| `active` | Fully operational. Setup complete. Users can log in. **Cannot be set unless `setup_status = completed`.** | Automatic after setup, or manual reactivation |
| `inactive` | Voluntarily deactivated or subscription lapse. Data preserved. Users cannot log in. | Institute admin, platform admin |
| `suspended` | Forcibly suspended. Data preserved. Users cannot log in. | Platform admin, reseller admin (full_management) |
| `rejected` | Reviewed and rejected during pending/pending_approval. Terminal. | Platform admin |

### 3.12 Soft Delete

Sets `deleted_at` timestamp. Soft-deleted institutes:
- Invisible via RLS to all tenant-scoped queries
- Visible via `withTrash(db, tenantId, fn)` which sets `app.include_deleted = true` — used by platform admin for restore operations and compliance queries
- Preserve all child data (standards, sections, subjects) for potential restore
- Release unique constraints via partial unique indexes `WHERE deleted_at IS NULL`
- Can be restored by platform admin (clears `deleted_at` and `deleted_by`)

---

## 4. Aggregate: InstituteGroup (Minimal — v1)

### 4.1 Purpose

An institute group represents a trust, society, chain, or management body that operates one or more institutes. In v1, this is **informational only**.

### 4.2 Fields

- **Name** — legal name (e.g., "DPS Society", "Sunrise Educational Trust")
- **Code** — short unique identifier (e.g., "DPS", "SUNRISE")
- **Type** — `trust`, `society`, `chain`, `franchise`
- **Registration Number** — Society/trust registration number under the Societies Registration Act
- **Registration State** — State where registered
- **Contact** — JSONB, same structure as institute contact (phones + emails)
- **Address** — JSONB, registered office address
- **Status** — `active`, `inactive`
- **created_at**, **updated_at**, **created_by**, **deleted_at**

### 4.3 What Groups Do NOT Do in v1

- No `group_memberships` table — no group-level users or roles
- No consolidated dashboard
- No config inheritance
- No institute creation powers
- No cross-institute operations

### 4.4 What Groups Enable in v1

- Platform/reseller admin UI groups institutes by trust instead of flat list
- Platform analytics can report per-group metrics
- The FK exists for v2 when group operational powers are built

### 4.5 RLS

`institute_groups` has no `tenant_id`. Access controlled via explicit policies:

```sql
ALTER TABLE institute_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE institute_groups FORCE ROW LEVEL SECURITY;

-- Platform admin: full access
CREATE POLICY group_admin_all ON institute_groups
  FOR ALL TO roviq_admin
  USING (true) WITH CHECK (true);

-- Reseller: read groups that contain their institutes
CREATE POLICY group_reseller_read ON institute_groups
  FOR SELECT TO roviq_reseller
  USING (id IN (
    SELECT group_id FROM institutes
    WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    AND group_id IS NOT NULL
  ));

-- Institute user: read their own institute's group (if any)
CREATE POLICY group_tenant_read ON institute_groups
  FOR SELECT TO roviq_app
  USING (id = (
    SELECT group_id FROM institutes
    WHERE id = current_setting('app.current_tenant_id', true)::uuid
  ));
```

---

## 5. Aggregate: Academic Year

### 5.1 Fields

- **Label**: "2025-2026"
- **Start date / End date**: DATE type. Typically April–March for schools, but configurable.
- **Term structure**: JSONB array of terms `[{ label, start_date, end_date }]`
- **Board exam dates**: JSONB, optional
- **Status**: `planning`, `active`, `completing`, `archived`
- **tenant_id**: FK → institutes
- Plus all `entityColumns` (created_at/by, updated_at/by, deleted_at/by, version)

### 5.2 Invariants

1. **Exactly one active academic year per institute.** Partial unique index on `(tenant_id) WHERE is_active = true AND deleted_at IS NULL`.
2. **Start date must precede end date.** CHECK constraint.
3. **No overlapping date ranges** within the same institute — **for schools only**. For coaching, academic years can overlap (a 2-year JEE program spans two calendar years). Enforced via exclusion constraint with a condition: `EXCLUDE USING gist (tenant_id WITH =, daterange(start_date, end_date) WITH &&) WHERE (institute_type = 'school')`. The institute type check requires a function or trigger since cross-table exclusion constraints aren't directly possible — alternatively, enforce at application level with a clear comment explaining why.
4. **Cannot be deleted if it's the only one.** Application-level validation.
5. **Activating a new year deactivates the current one.** Single transaction.

### 5.3 Lifecycle

```
planning ──→ active ──→ completing ──→ archived
```

- **planning**: New year being set up. Standards/sections created, promotions pending. No operational activity (attendance, fees).
- **active**: Current operational year. Only one per institute.
- **completing**: End-of-year: final exams, result processing, promotions. Still active for data entry.
- **archived**: Read-only. Historical. Cannot be modified except for compliance corrections by platform admin.

---

## 6. Aggregate: Standard

### 6.1 What Is a Standard?

A standard represents a class/grade level within an institute for a specific academic year. "Class 5" in 2025-2026 is a different standard entity than "Class 5" in 2024-2025 (cloned, not referenced — standards can change between years and historical data must be immutable).

For coaching: maps to a course (e.g., "JEE 2026 Preparation").
For library: maps to a membership category (e.g., "Library").

### 6.2 Fields

- **Name**: Display name. Free-text with board-default seed data.
- **Numeric Order**: Integer for sorting. Pre-primary: -3, -2, -1. Class 1 = 1 through 12 = 12. Coaching: arbitrary.
- **Level** (traditional): `pre_primary`, `primary`, `upper_primary`, `secondary`, `senior_secondary`. Null for coaching/library.
- **NEP Stage**: `foundational`, `preparatory`, `middle`, `secondary`. Null for coaching/library.
- **Department**: Explicit, may differ from level for some schools.
- **Is Board Exam Class**: Boolean. CBSE: 10, 12. BSEH: 8, 10, 12. RBSE: 5, 8, 10, 12.
- **Stream Applicable**: Boolean. True for Class 11-12. When true, sections under this standard must have a stream.
- **Max Sections Allowed**: Soft limit per SARAS approval.
- **Max Students Per Section**: Default from institute config's section strength norms (40 for CBSE). Overridable per standard.
- **Academic Year**: FK to the academic year.
- **UDISE+ Class Code**: Numeric (-3 for Nursery through 12 for Class 12). For UDISE+ DCF export.
- **tenant_id**: FK → institutes
- Plus all `entityColumns`

### 6.3 Invariants

1. Standard names unique within same institute and academic year. Partial unique index: `(tenant_id, academic_year_id, name) WHERE deleted_at IS NULL`.
2. Numeric order unique within same institute and academic year.
3. Standard with active enrollments (queried from Enrollment Service via event/query) cannot be hard-deleted. Soft delete only.
4. Board exam class designation should match the institute's board configuration (application-level validation with warning, not hard block — some schools are transitioning between boards).

### 6.4 Soft Delete

Standards follow the same `entityColumns` soft delete pattern. A soft-deleted standard's sections and subjects become orphaned from the active structure but are preserved for historical queries and `withTrash()` access.

### 6.5 Seed Data

| Department | Standards Seeded (School) |
|---|---|
| Pre-Primary | Nursery (-3), LKG (-2), UKG (-1) |
| Primary | Class 1 through Class 5 |
| Upper Primary | Class 6, Class 7, Class 8 |
| Secondary | Class 9, Class 10 |
| Senior Secondary | Class 11, Class 12 |

Coaching: no auto-seeding. Library: single "Library" standard.

---

## 7. Aggregate: Section

### 7.1 What Is a Section?

A section is a group of students within a standard who share a timetable, class teacher, and (at senior secondary) a stream. For coaching, a section is a batch.

### 7.2 Fields

- **Name**: "A", "B", "C" or thematic ("Gandhi", "Ganga"). Coaching: "Morning", "Evening".
- **Display Label**: Optional full name (code is "A", label is "Ganga").
- **Standard**: FK to parent standard.
- **Stream**: JSONB, nullable. For Class 11-12: `{ "name": "Science PCM", "code": "sci_pcm" }`. Null for non-stream-applicable standards. Not a separate entity — streams are a small fixed set per board that rarely changes, and NEP 2020 cross-stream combinations mean a section might have a non-standard stream label.
- **Medium of Instruction**: VARCHAR. The language used for teaching. Examples: `english`, `hindi`, `bilingual`, `urdu`. Per-section, not per-institute. A school may run 5-A in English and 5-B in Hindi. Not a reference table — it's a small set that varies by school and doesn't justify a join.
- **Shift**: VARCHAR, nullable. References institute config's shift name. Null if institute doesn't use shifts.
- **Class Teacher**: UUID FK → memberships (teacher membership). Nullable — assigned after setup.
- **Room**: VARCHAR, nullable. Physical room identifier. Room management out of scope for v1.
- **Capacity**: INTEGER. Max students. Default inherited from standard's `max_students_per_section`.
- **Current Strength**: INTEGER, default 0. Denormalized count. Updated on enrollment events from Enrollment Service.
- **Gender Restriction**: `co_ed`, `boys_only`, `girls_only`.
- **Display Order**: Integer for sorting within a standard.
- **Academic Year**: FK. Denormalized from standard for query efficiency.
- **Coaching-specific fields** (null for schools):
  - `batch_start_time` / `batch_end_time`: TIME fields
  - `batch_status`: `upcoming`, `active`, `completed`
- **tenant_id**: FK → institutes
- Plus all `entityColumns`

### 7.3 Invariants

1. Section names unique within the same standard. Partial unique index: `(standard_id, name) WHERE deleted_at IS NULL`.
2. Stream JSONB is required (non-null) when parent standard has `stream_applicable = true`. Application-level validation.
3. **Capacity enforcement uses board-level norms from institute config:**
   - If `current_strength` reaches `capacity` (typically 40): warning event emitted.
   - If `current_strength` exceeds `config.section_strength_norms.hard_max` (typically 45): override requires explicit reason captured in audit log. CBSE allows up to 45 in exceptional cases (defense/central govt employee transfers).
   - The system never hard-blocks enrollment — real schools need flexibility. Warnings and audit trails are the enforcement mechanism.
4. Section with active enrollments cannot be hard-deleted. Soft delete only.
5. Class teacher assignment limited to configurable N sections (default 1 for schools, unlimited for coaching).

### 7.4 Soft Delete

Follows `entityColumns` pattern. Soft-deleted sections are invisible in normal queries, visible via `withTrash()`.

### 7.5 Seed Data

Schools: 4 sections per standard (A, B, C, D) — configurable during creation.
Coaching: no auto-seeding.
Library: 2 sections ("Full Day", "Half Day").

---

## 8. Aggregate: Subject

### 8.1 What Is a Subject?

A subject is an academic discipline offered at specific standards. Subjects are **seeded per-institute** from a board catalog during setup — each institute gets their own copy that they can customize (rename, adjust assessment weightage, add non-board subjects). This means subjects are tenant-scoped entities, not global references.

### 8.2 Fields

- **Name**: "Mathematics", "Physics", "English Language and Literature"
- **Short Name**: "Math", "Phy", "Eng"
- **Board Code**: VARCHAR, nullable. CBSE: 041 (Math Standard), 042 (Physics), 184 (English). Null for non-board subjects (custom, extracurricular).
- **Board**: VARCHAR, nullable. Which board's code system this belongs to. Null for custom subjects.
- **Type**: `academic`, `language`, `skill`, `extracurricular`, `internal_assessment`
- **Is Mandatory**: Boolean. Whether compulsory for the standard.
- **Has Practical**: Boolean. Affects theory/practical mark split.
- **Theory Max Marks** / **Practical Max Marks** / **Internal Max Marks**: INTEGER. Assessment weightage. CBSE typically: 80/0/20 (no practical) or 70/30/0 (with practical) for board exams; varies for internal assessment subjects.
- **Is Elective**: Boolean. Whether students choose this subject.
- **Elective Group**: VARCHAR, nullable. Groups mutually exclusive electives (e.g., "math_level" for "Math Standard" vs "Math Basic").
- **tenant_id**: FK → institutes
- Plus all `entityColumns`

### 8.3 Subject-Standard Mapping

Many-to-many via `subject_standards` junction table:

| Column | Type |
|---|---|
| subject_id | UUID FK → subjects |
| standard_id | UUID FK → standards |
| tenant_id | UUID FK → institutes (denormalized for RLS) |

### 8.4 Subject-Section Mapping

Many-to-many via `subject_sections` junction table. This is how stream-specific subjects work: "Physics" is linked to Science stream sections at Class 11, not to Commerce sections.

| Column | Type |
|---|---|
| subject_id | UUID FK → subjects |
| section_id | UUID FK → sections |
| tenant_id | UUID FK → institutes (denormalized for RLS) |

For mandatory subjects: eager mapping (auto-assigned to all sections in the standard during seeding).
For elective subjects: lazy mapping (admin explicitly assigns to specific sections).

### 8.5 Invariants

1. Board code unique per standard within an institute. Partial unique index: `(tenant_id, board_code, standard_id) WHERE board_code IS NOT NULL AND deleted_at IS NULL`. Custom subjects (null board_code) are exempt.
2. Mandatory subjects cannot be removed from a standard if students are enrolled.
3. Elective subjects in the same elective group are mutually exclusive for student enrollment (enforced by Enrollment Service).
4. Subject with recorded assessments cannot be hard-deleted. Soft delete only.

### 8.6 Seeding from Board Catalog

During institute setup, the Temporal workflow:
1. Reads a **board subject catalog config** (stored as seed data files per board, not a database table) containing all CBSE/BSEH/RBSE subjects with codes, types, assessment splits
2. For each standard the institute has, creates subject records from the catalog
3. Links subjects to standards via `subject_standards`
4. Links mandatory subjects to all sections via `subject_sections`
5. Leaves elective subjects unlinked (admin assigns later)

The catalog is a config file (JSON/YAML) shipped with the application, not a database table. This makes it easy to update when boards change curriculum — just update the file and re-seed new institutes. Existing institutes are unaffected (they have their own copies).

---

## 9. Three-Tier RLS

### 9.1 RLS Pattern for All Tenant-Scoped Tables

Every tenant-scoped table (standards, sections, subjects, institute_branding, institute_configs, institute_sessions, institute_identifiers, institute_affiliations, subject_standards, subject_sections) follows this exact pattern:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

-- Institute users: full CRUD on their tenant's rows
CREATE POLICY <table>_tenant_all ON <table_name>
  FOR ALL TO roviq_app
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Reseller: read-only across their reseller's institutes
CREATE POLICY <table>_reseller_read ON <table_name>
  FOR SELECT TO roviq_reseller
  USING (tenant_id IN (
    SELECT id FROM institutes
    WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
  ));

-- Admin: full access
CREATE POLICY <table>_admin_all ON <table_name>
  FOR ALL TO roviq_admin
  USING (true) WITH CHECK (true);
```

**Critical: `FORCE ROW LEVEL SECURITY`** is mandatory on every table. Without it, the table owner bypasses all policies silently. The auth PRD uses FORCE on every table definition.

### 9.2 GRANTs

GRANTs are the **first layer** of access control. RLS policies are the **second layer**. A `FOR ALL` RLS policy does not help if the role only has `SELECT` granted. Both must be correct.

```sql
-- roviq_app: full CRUD (RLS limits to their tenant)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  standards, sections, subjects, subject_standards, subject_sections,
  institute_branding, institute_configs, institute_sessions,
  institute_identifiers, institute_affiliations
TO roviq_app;

-- roviq_reseller: read-only on tenant data
GRANT SELECT ON
  standards, sections, subjects, subject_standards, subject_sections,
  institute_branding, institute_configs, institute_sessions,
  institute_identifiers, institute_affiliations, institutes
TO roviq_reseller;

-- roviq_admin: full access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;

-- All roles need sequence access for inserts
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;
```

### 9.3 Institute Table RLS (Special Case)

The `institutes` table itself is the tenant root. Per auth PRD Section 8:

```sql
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutes FORCE ROW LEVEL SECURITY;

-- Institute users can read their own institute
CREATE POLICY institute_tenant_read ON institutes
  FOR SELECT TO roviq_app
  USING (id = current_setting('app.current_tenant_id', true)::uuid);

-- Reseller can manage their institutes (GRANTs control which operations)
CREATE POLICY institute_reseller_all ON institutes
  FOR ALL TO roviq_reseller
  USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid)
  WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);

-- Admin can manage all
CREATE POLICY institute_admin_all ON institutes
  FOR ALL TO roviq_admin
  USING (true) WITH CHECK (true);
```

**Note on reseller policy:** The `FOR ALL` policy combined with the GRANT determines actual operations. If `roviq_reseller` is only GRANTed `SELECT, INSERT, UPDATE` on institutes, the `FOR ALL` policy permits those three but DELETE is blocked by the missing GRANT. This layered approach lets the policy be permissive while GRANTs enforce operation restrictions.

### 9.4 CASL Actions

| CASL Subject | Actions |
|---|---|
| `Institute` | `create`, `read`, `update_info`, `update_status`, `update_branding`, `update_config`, `delete`, `restore`, `view_statistics`, `impersonate` |
| `InstituteGroup` | `create`, `read`, `update`, `delete` |
| `AcademicYear` | `create`, `read`, `update`, `activate`, `archive`, `delete` |
| `Standard` | `create`, `read`, `update`, `delete` |
| `Section` | `create`, `read`, `update`, `delete`, `assign_teacher` |
| `Subject` | `create`, `read`, `update`, `delete`, `assign_to_standard`, `assign_to_section` |

### 9.5 Who Can Do What (Three-Tier)

| Action | Platform Admin | Reseller (full) | Reseller (support) | Reseller (viewer) | Institute Admin | Principal | Teacher |
|---|---|---|---|---|---|---|---|
| Institute: create | ✓ (any reseller) | ✓ (own, with approval) | | | | | |
| Institute: read | ✓ (all) | ✓ (own reseller) | ✓ (own reseller) | ✓ (own reseller) | ✓ (own) | ✓ (own) | ✓ (own) |
| Institute: update_info | ✓ | ✓ (own reseller) | | | ✓ | | |
| Institute: update_status | ✓ | ✓ (suspend/reactivate own) | | | | | |
| Institute: delete | ✓ | | | | | | |
| InstituteGroup: create | ✓ | ✓ (own reseller) | | | | | |
| Standard: create | ✓ | | | | ✓ | | |
| Standard: read | ✓ | ✓ (read-only) | ✓ (read-only) | ✓ (read-only) | ✓ | ✓ | ✓ |
| Section: assign_teacher | ✓ | | | | ✓ | ✓ | |
| Subject: create | ✓ | | | | ✓ | | |

**No reseller tier can delete an institute.** Only platform admin can. Per auth PRD Section 5.2.

### 9.6 Impersonation into Institutes

Three sources per auth PRD Section 12:

| From | Into | OTP Required | Auth PRD Reference |
|---|---|---|---|
| Platform admin/support | Any institute user | Configurable per institute | Section 12.1 |
| Reseller admin | Users in their institutes only | Yes — OTP to institute admin | Section 12.1 |
| Institute admin | Staff/students in their institute | No | Section 12.2 |
| Principal | Teachers/students below them | No | Section 12.2 |

During impersonation:
- `actor_id` = real person, `user_id` = impersonated person, `impersonator_id` = same as `actor_id`
- `impersonation_session_id` links to the session record
- Institute admins can see all impersonation entries in their audit log (transparency)

---

## 10. Institute Creation Workflow

### 10.1 Who Can Create

| Actor | Wrapper | Reseller Assignment | Approval |
|---|---|---|---|
| Platform admin | `withAdmin()` | Chooses any reseller | Immediate → `pending` |
| Reseller (full_management) | `withReseller()` | Auto-assigned to their reseller | Requires platform approval → `pending_approval` |

### 10.2 Reseller Creation with Approval

1. Reseller staff calls `resellerCreateInstituteRequest`
2. Institute created with `status = pending_approval`
3. `institute.approval_requested` event emitted → platform admin notified
4. Platform admin reviews:
   - **Approve**: `status → pending`, Temporal setup workflow triggers
   - **Reject**: `status → rejected` with reason

### 10.3 Platform Admin Direct Creation

1. Platform admin calls `adminCreateInstitute`
2. Institute created with `status = pending`
3. Temporal setup workflow triggers immediately

### 10.4 Setup Pipeline (Temporal)

**Workflow: `InstituteSetupWorkflow`**
**Input:** Institute ID + metadata (type, departments, board, isDemo, session info, creating user ID)
**Timeout:** 10 minutes

#### Phase 1: Identity (Sequential)

1. **Request Identity Service to create "Admin" role** — NATS call to Identity Service with role definition (name, scope=institute, tenant_id, abilities). Identity Service creates the role in the `roles` table.
2. **Request Identity Service to create admin membership** — NATS call with user_id (the creating user or a new invited user), tenant_id, role_id. Identity Service creates a row in the `memberships` table (the institute-scoped membership table per auth PRD Section 4.4). Generates a secure random password if new user. Enforces password change on first login.
3. **Request Identity Service to create "System" role** — for automated operations within this institute.
4. **Set admin as institute representative** — updates institute record.

**Critical clarification:** The setup workflow does NOT directly write to `memberships`, `users`, or `roles` tables. It calls Identity Service via NATS. The actor context (who initiated the institute creation) is propagated via NATS message headers for audit trail purposes.

#### Phase 2: Infrastructure (Parallel)

1. Create storage bucket (MinIO/S3) for the institute
2. Create wallets (fund, virtual, cash, expense) via Finance Service
3. Request Identity Service to create default roles for all user types (teacher, student, parent, accountant, etc.)

#### Phase 3: Academic Structure (Sequential per department, parallel across departments)

For each department:
1. Create standards with board-appropriate names, codes, levels, NEP stages
2. Create default sections per standard
3. Seed subjects from board catalog config, link to standards and sections

#### Phase 4: Configuration (Parallel)

1. Generate default notification config
2. Set section strength norms based on board
3. Create first academic year in `active` state

#### Phase 5: Demo Data (Conditional — only if `is_demo = true`)

Generate sample data. Demo institutes have all notification channels `is_active = false`.

### 10.5 Idempotency

Every activity checks "does this already exist?" before creating. Safe to retry.

---

## 11. Resolver Structure

Per auth PRD Section 16, resolvers are grouped by scope with prefixed operation names.

### 11.1 Admin Module Group (Platform Scope — `PlatformScopeGuard`)

```
admin/institute/
  adminCreateInstitute
  adminApproveInstitute
  adminRejectInstitute
  adminListInstitutes
  adminGetInstitute
  adminUpdateInstituteStatus
  adminDeleteInstitute
  adminRestoreInstitute
  adminInstituteStatistics

admin/institute-group/
  adminCreateInstituteGroup
  adminListInstituteGroups
  adminUpdateInstituteGroup
  adminDeleteInstituteGroup
```

### 11.2 Reseller Module Group (Reseller Scope — `ResellerScopeGuard`)

```
reseller/institute/
  resellerCreateInstituteRequest
  resellerListInstitutes
  resellerGetInstitute
  resellerSuspendInstitute
  resellerReactivateInstitute
  resellerInstituteStatistics

reseller/institute-group/
  resellerCreateInstituteGroup
  resellerListInstituteGroups
```

### 11.3 Institute Module Group (Institute Scope — `InstituteScopeGuard`)

```
institute/
  myInstitute
  updateInstituteInfo
  updateInstituteBranding
  updateInstituteConfig

institute/academic-year/
  listAcademicYears
  createAcademicYear
  activateAcademicYear
  updateAcademicYear

institute/standard/
  listStandards
  createStandard
  updateStandard
  deleteStandard

institute/section/
  listSections
  createSection
  updateSection
  deleteSection
  assignClassTeacher

institute/subject/
  listSubjects
  createSubject
  updateSubject
  deleteSubject
  assignSubjectToStandard
  assignSubjectToSection
```

---

## 12. Domain Events

All events published via NATS JetStream. Audit interceptor captures mutations automatically (per Audit PRD).

### 12.1 Institute Events

| Event | Payload | Scope on Audit | Consumers |
|---|---|---|---|
| `institute.approval_requested` | `{ instituteId, resellerId, requestedBy }` | reseller | Notification (to platform admin) |
| `institute.approved` | `{ instituteId, approvedBy }` | platform | Setup workflow (Temporal) |
| `institute.created` | Full institute data | platform or reseller | Audit |
| `institute.activated` | `{ instituteId, previousStatus }` | institute | Notification, Billing |
| `institute.suspended` | `{ instituteId, suspendedBy, reason }` | platform or reseller | All tenant services |
| `institute.reseller_changed` | `{ instituteId, oldResellerId, newResellerId }` | platform | Notification to institute admin |
| `institute.deleted` | `{ instituteId, deletedBy }` | platform | All tenant services |
| `institute.restored` | `{ instituteId, restoredBy }` | platform | All tenant services |
| `institute.config_updated` | `{ instituteId, changedFields }` | institute | Attendance, Notification |
| `institute.branding_updated` | `{ instituteId, branding }` | institute | Frontend (subscription) |

**Audit scope field:** Per updated Audit PRD (auth PRD Section 15), audit entries now carry `scope` (platform/reseller/institute) and `reseller_id`. Events triggered by reseller actions use `scope = 'reseller'` with the acting reseller's ID. Events triggered by institute users use `scope = 'institute'` with the `tenant_id`. Events by platform admin use `scope = 'platform'` with both null.

### 12.2 Academic Year Events

| Event | Payload | Consumers |
|---|---|---|
| `academic_year.created` | `{ academicYearId, tenantId, label }` | Dashboard |
| `academic_year.activated` | `{ academicYearId, tenantId, previousYearId }` | All academic services (switch context) |
| `academic_year.archived` | `{ academicYearId, tenantId }` | All services (make read-only) |

### 12.3 Standard Events

| Event | Payload | Consumers |
|---|---|---|
| `standard.created` | `{ standardId, tenantId, name, level }` | Section auto-creation (if configured), Dashboard |
| `standard.updated` | `{ standardId, tenantId, changedFields }` | Timetable, Attendance |
| `standard.deleted` | `{ standardId, tenantId }` | Enrollment (block new enrollments), Timetable |

### 12.4 Section Events

| Event | Payload | Consumers |
|---|---|---|
| `section.created` | `{ sectionId, standardId, tenantId }` | Timetable |
| `section.updated` | `{ sectionId, tenantId, changedFields }` | Timetable, Attendance |
| `section.teacher_assigned` | `{ sectionId, teacherMembershipId, tenantId }` | Notification (to teacher) |
| `section.strength_changed` | `{ sectionId, newStrength, capacity, tenantId }` | Dashboard (real-time) |
| `section.capacity_warning` | `{ sectionId, strength, capacity, hardMax, tenantId }` | Admin alert |
| `section.deleted` | `{ sectionId, tenantId }` | Enrollment, Timetable, Attendance |

### 12.5 Subject Events

| Event | Payload | Consumers |
|---|---|---|
| `subject.created` | `{ subjectId, tenantId, standardIds }` | Timetable |
| `subject.assigned_to_section` | `{ subjectId, sectionId, tenantId }` | Timetable, Attendance |
| `subject.removed_from_section` | `{ subjectId, sectionId, tenantId }` | Timetable, Attendance |
| `subject.deleted` | `{ subjectId, tenantId }` | Timetable, Assessment |

### 12.6 Subscription Filtering

GraphQL subscriptions filter events by the subscriber's scope:
- **Institute user** subscriptions: filtered by `tenantId` from JWT. Only receives events for their own institute.
- **Reseller user** subscriptions: filtered by `resellerId` from JWT. Receives events for all institutes under their reseller. (Useful for reseller dashboard showing real-time activity across their institutes.)
- **Platform admin** subscriptions: no filtering. Receives all events. (Useful for system monitoring.)

---

## 13. GraphQL Subscriptions

All subscriptions use `graphql-ws` with ws-ticket authentication per auth PRD Section 10.7.

### 13.1 Institute Scope Subscriptions

```graphql
type Subscription {
  instituteUpdated: Institute!                     # any field change on my institute
  instituteBrandingUpdated: InstituteBranding!     # branding changes
  instituteConfigUpdated: InstituteConfig!         # config changes
  academicYearActivated: AcademicYear!             # year switch
  sectionStrengthChanged(sectionId: UUID): SectionStrengthUpdate!  # enrollment count
  instituteSetupProgress: InstituteSetupProgress!  # setup workflow progress
}

type InstituteSetupProgress {
  instituteId: UUID!
  step: String!
  status: SetupStepStatus!   # pending, in_progress, completed, failed
  message: String
  completedSteps: Int!
  totalSteps: Int!
}
```

### 13.2 Reseller Scope Subscriptions

```graphql
type Subscription {
  resellerInstituteCreated: Institute!          # new institute under their reseller
  resellerInstituteStatusChanged: InstituteStatusUpdate!  # status change on any of their institutes
}
```

### 13.3 Platform Scope Subscriptions

```graphql
type Subscription {
  adminInstituteApprovalRequested: InstituteApprovalRequest!  # reseller requests approval
  adminInstituteCreated: Institute!                           # any new institute
}
```

---

## 14. Error Handling

### 14.1 Error Response Structure

Every error follows a consistent structure:

```json
{
  "statusCode": 409,
  "error": "INSTITUTE_CODE_DUPLICATE",
  "message": "An institute with code 'DPI-MR' already exists."
}
```

Error codes are machine-readable and language-independent. Messages are i18n-translated via `nestjs-i18n` using `acceptLanguage` from request context.

### 14.2 Institute Errors

| Scenario | Code | HTTP | Details |
|---|---|---|---|
| No CASL permission | `FORBIDDEN` | 403 | Never 500. Auth PRD is clear on this. |
| Institute not found | `INSTITUTE_NOT_FOUND` | 404 | |
| Duplicate code | `INSTITUTE_CODE_DUPLICATE` | 409 | Among non-deleted institutes |
| Duplicate primary email | `INSTITUTE_EMAIL_DUPLICATE` | 409 | Among non-deleted institutes |
| Activate before setup complete | `SETUP_NOT_COMPLETE` | 422 | `setup_status` must be `completed` |
| Reseller not found / inactive | `RESELLER_INVALID` | 422 | |
| System reseller cannot be modified | `SYSTEM_RESELLER_PROTECTED` | 422 | "Roviq Direct" is immutable |
| Concurrent modification | `CONCURRENT_MODIFICATION` | 409 | `version` mismatch — another user updated simultaneously |
| Empty result set | — | 200 | Returns empty array, NOT 404. An empty array is a valid query result. |

### 14.3 Academic Year Errors

| Scenario | Code | HTTP |
|---|---|---|
| Overlapping dates | `ACADEMIC_YEAR_OVERLAP` | 400 |
| Start ≥ end | `INVALID_DATE_RANGE` | 400 |
| Cannot delete last year | `LAST_ACADEMIC_YEAR` | 422 |
| Cannot activate (another active) | `YEAR_ALREADY_ACTIVE` | 409 |

### 14.4 Standard / Section / Subject Errors

| Scenario | Code | HTTP |
|---|---|---|
| Duplicate name in same year | `STANDARD_NAME_DUPLICATE` / `SECTION_NAME_DUPLICATE` | 409 |
| Cannot delete — active enrollments | `HAS_ACTIVE_ENROLLMENTS` | 422 |
| Cannot delete — has assessments | `HAS_RECORDED_ASSESSMENTS` | 422 |
| Stream required but missing | `STREAM_REQUIRED` | 400 |
| Capacity exceeded without override | `SECTION_CAPACITY_EXCEEDED` | 422 |
| Board code duplicate per standard | `SUBJECT_CODE_DUPLICATE` | 409 |

---

## 15. Compliance & Reporting

### 15.1 UDISE+ DCF Export

The system generates data matching the UDISE+ Data Capture Format for:
- School profile (identifiers, management type, category, location — from institute entity)
- Section-wise enrollment by gender/category (from Enrollment Service data)
- Teacher details (from Identity Service profiles)
- Infrastructure (out of scope for v1 — these fields would need a separate infrastructure module)

**Implementation:** A report generator that maps Roviq entities to UDISE+ field codes. Not a live integration (UDISE+ has no public API).

### 15.2 CBSE OASIS Compliance

OASIS 7.0 collects 13 sections of data annually. Roviq stores or derives:
- School profile (from institute entity)
- Faculty categorization (PGT/TGT/PRT — from teacher profiles)
- Academic details with CBSE subject codes (from subjects)
- Student enrollment per class by gender (from Enrollment Service)
- UDISE information (from institute identifiers)

### 15.3 State Portal Data

- **Haryana MIS Portal**: student registration numbers, staff statements
- **Rajasthan Shala Darpan**: student/teacher Shala Darpan IDs, enrollment, attendance

State-specific identifiers stored in `institute_identifiers` (for institute-level) and in profiles (for user-level: Shala Darpan ID, BSEH enrollment number).

### 15.4 Reseller Compliance Role

Resellers have **read-only access** to all tenant-scoped compliance data across their institutes (via `roviq_reseller` RLS). This enables:
- Reseller support staff helping an institute prepare UDISE+ submissions
- Reseller generating cross-institute reports for regulatory bodies
- Reseller verifying data quality across their portfolio

Resellers cannot modify compliance data — all modifications go through institute admins or platform admin.

### 15.5 DPDP Act Compliance

- Verifiable parental consent required for all student data (under-18)
- Purpose-limited collection — every data field has a documented purpose
- Right to erasure — soft delete with full audit trail, data export capability
- Breach notification — 72-hour window to Data Protection Board
- **Deadline: May 2027**

---

## 16. Performance Considerations

| Concern | Mitigation | Target |
|---|---|---|
| Reseller listing their institutes (could be 500+) | B-tree index on `institutes.reseller_id` + cursor pagination | < 100ms for 50 results |
| Reseller RLS subquery on tenant-scoped tables | `tenant_id IN (SELECT id FROM institutes WHERE reseller_id = ...)` — index on `institutes.reseller_id` makes the subquery fast. For very large resellers (500+ institutes), consider a materialized `reseller_institute_ids` set in Redis refreshed on institute create/delete. | < 5ms for RLS evaluation |
| Platform admin listing all institutes (could be 10K+) | Full-text search (tsvector + GIN index) + trigram index for typeahead + cursor pagination | < 100ms for 50 results |
| Standards/sections per institute (~1,200 rows max) | Small dataset per tenant. B-tree on tenant_id | < 50ms |
| Optimistic concurrency (version check) | Single atomic UPDATE with WHERE version = N. No extra round-trip. | < 1ms overhead |
| Setup workflow | Parallel execution of independent phases | < 30s total |

---

## 17. Search and Filtering

### 17.1 Platform Admin (All Institutes)

- Full-text search on name + code (PostgreSQL tsvector with GIN index)
- Trigram index on name for typeahead (`pg_trgm` extension)
- Filter by: status, type, board affiliation, reseller, group, state, district, creation date range
- Sort by: name, created_at, status, type
- Cursor-based pagination (Relay-style)

### 17.2 Reseller (Their Institutes)

Same filters as platform admin. RLS automatically limits to `reseller_id = current_setting('app.current_reseller_id')`. No application-level filtering needed.

### 17.3 Institute-Scoped (Standards / Sections / Subjects)

- Filter standards by: level, department, NEP stage, is_board_exam_class, academic_year
- Filter sections by: standard, stream, shift, medium, class teacher, gender restriction
- Filter subjects by: type, is_mandatory, has_practical, standard, board_code
- Sort by: numeric_order (standards), display_order (sections)
- Default: only show entities for the active academic year

---

## 18. Testing Strategy

### 18.1 Three-Tier RLS Tests (Mandatory in CI)

| # | Test | Assert |
|---|---|---|
| 1 | `roviq_pooler` without SET LOCAL ROLE → SELECT on standards | Permission denied |
| 2 | `roviq_app` with tenant A context → query standards | Only tenant A's standards |
| 3 | `roviq_app` with tenant A context → query tenant B's standards | 0 rows |
| 4 | `roviq_app` → query platform_memberships | 0 rows (no GRANT, no policy) |
| 5 | `roviq_app` → query reseller_memberships | 0 rows |
| 6 | `roviq_reseller` with reseller A context → query institutes | Only reseller A's institutes |
| 7 | `roviq_reseller` with reseller A context → query reseller B's institutes | 0 rows |
| 8 | `roviq_reseller` → INSERT into standards | Permission denied (read-only GRANT) |
| 9 | `roviq_reseller` → DELETE from institutes | Permission denied (no DELETE GRANT) |
| 10 | `roviq_admin` → query any table | Data returned |
| 11 | `roviq_admin` → query with FORCE RLS active | All rows visible (via USING(true) policies) |
| 12 | FORCE RLS present on every table | Query `pg_class` + `pg_policy` to verify all tenant-scoped tables have `relforcerowsecurity = true` |

### 18.2 Business Logic Tests

- Academic year: overlap detection, activation/deactivation, coaching overlapping years allowed
- Session activation: partial unique index enforces single active
- Standard seeding: correct standards per board/department
- Subject seeding: correct subjects per board/standard with codes
- Phone validation: country code format, number length, primary uniqueness
- CASL ability compilation: role + membership overrides merged correctly
- Optimistic concurrency: concurrent updates with same version → one succeeds, one gets 409
- Soft delete: deleted entities invisible in normal queries, visible via `withTrash()`

### 18.3 Integration Tests

- Full institute creation → approval (if reseller) → setup workflow → standards/sections/subjects populated
- Reseller suspension → institute operations unaffected
- Reseller deletion → institutes move to Roviq Direct
- Institute group assignment → grouping visible in admin/reseller queries
- `pending_approval` → `approved` → `pending` → setup completes → `active` full flow

---

## 19. Open Questions

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Should coaching academic years have a different model than school years? | A) Same entity, relax overlap constraint for coaching. B) Separate `coaching_periods` entity. | A — Same entity, application-level overlap enforcement per institute type. Simpler. |
| 2 | Should medium of instruction be a reference table or free text? | A) Reference table. B) VARCHAR with common presets in UI dropdown. | B — VARCHAR. The set is small, varies by school, and doesn't justify a join. UI shows common options (English, Hindi, Bilingual, Urdu) with a custom entry option. |
| 3 | When should InstituteGroup get operational powers? | When multi-campus customers appear | Add `group_memberships (user_id, group_id, role_id)`. Group roles: `group_owner`, `group_admin`, `group_viewer`. Consolidated dashboard. Config inheritance. |
| 4 | Should reseller-created institute approval be async? | A) Async with notification. B) Synchronous. | A — Async. Platform admin may not be online. |
| 5 | Should the board subject catalog be a database table instead of config files? | A) DB table (queryable, updatable without deploy). B) Config files (simpler). | B for v1. Board curricula change once per year. A config file update + deploy is fine. If curriculum changes become frequent, migrate to a DB table. |
| 6 | Should we support multiple affiliations per institute? | A) Yes — collection. B) Single affiliation. | A — Collection. Real schools have dual affiliations (CBSE + state recognition). Already modeled in Section 3.5. |

---

## 20. What We're Explicitly Skipping

| Feature | Why Not Now | When |
|---|---|---|
| InstituteGroup operational powers | Minimal group is sufficient for v1 | When multi-campus customers appear |
| Timetable management | Separate module | Timetable Service PRD |
| Student enrollment | Separate module | Enrollment Service PRD |
| Fee structure per section/standard | Finance module | Finance Service PRD |
| Transfer Certificate generation | Depends on enrollment | Document Service PRD |
| Custom domain per reseller | Infrastructure concern | Per auth PRD Phase 4 |
| Reseller white-label branding (full) | Auth PRD defers this | After core stable |
| Room/infrastructure management | Low impact for v1 | When timetable needs it |
| Student promotion/year rollover | Complex workflow | Academic Year Rollover PRD |
| House system | Nice-to-have | After core academics |
| APAAR/ABC integration | Still rolling out nationally | When adoption reaches critical mass |
| Online public application form | Needs form builder, payment gateway, OTP | Enrollment Service v2 |
| Bus route assignment on enrollment | Transport module doesn't exist | Transport Service PRD |

---

## 21. Decisions Already Made

| Decision | Choice | Why |
|---|---|---|
| Database | PostgreSQL 16 with RLS, five roles per auth PRD | Three-tier scoping at DB level |
| ORM | Drizzle v1 with `pgPolicy()` | Native RLS policy definitions |
| Connection | `roviq_pooler` (NOINHERIT) → `SET LOCAL ROLE` | Safe failure mode |
| Wrappers | `withTenant()`, `withReseller()`, `withAdmin()`, `withTrash()` | Explicit, testable, works for HTTP/NATS/Temporal |
| Multi-tenancy | Shared schema, shared tables, RLS | Simpler migrations, connection pooling |
| Users | Platform-level (Identity Service) | Multi-institute scenarios |
| Memberships | Three tables per auth PRD (platform, reseller, institute) | Scope-specific, no nullable FKs |
| Reseller | NOT NULL on institutes, "Roviq Direct" default | Per auth PRD |
| InstituteGroup | Minimal v1 — entity + FK, no memberships | Defer operational powers |
| Institute creation by reseller | With platform admin approval | Prevents unauthorized creation |
| Auth | CASL with role abilities + membership overrides | Flexible ABAC |
| Notifications | Novu via NotificationPort | Cloud now, self-hosted later |
| Workflows | Temporal.io | Idempotent setup, year rollover |
| Lint/Format | Biome | Single config, AI-agent-friendly |
| Real-time | graphql-ws with ws-ticket auth per auth PRD | Secure WebSocket |
| Institute types | school, coaching, library | Same model, different invariants |
| Board support (v1) | CBSE, BSEH, RBSE | Primary target market |
| Transfers (v1) | Only two institute admins | Simplest, v1-safe |
| Resolver naming | Prefixed per scope group per auth PRD Section 16.3 | Consistent across modules |
| Stream | JSONB on section | Small fixed set, NEP cross-stream makes separate entity overkill |
| Institute phones | JSONB on institutes | Rarely queried independently |
| Board subject catalog | Config files, seeded per-institute | Each institute gets customizable copies |
| Optimistic concurrency | `version` column on all entity tables | Prevents concurrent modification data loss |
| Soft delete | `deleted_at` + `withTrash()` for admin access | Per auth PRD pattern |
| Entity columns | `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `version` | Consistent across all tables |
