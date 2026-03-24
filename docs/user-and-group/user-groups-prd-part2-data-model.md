# User & Groups Service — PRD Part 2: Data Model

> **Every table, field, type, constraint, index, and RLS policy for profiles, groups, admission, certificates, and compliance.**
> Aligned with Auth PRD v3.0 (five DB roles, three-tier RLS), Institute PRD v3.1 (standards, sections, academic years), and Drizzle v1 native schema definitions.

---

## 1. Schema Ownership Map

Tables this module **owns** (creates, migrates, manages):

| Category | Tables |
|---|---|
| Profiles | `user_profiles`, `student_profiles`, `staff_profiles`, `guardian_profiles`, `bot_profiles` |
| Profile extensions | `student_academics`, `student_guardian_links`, `staff_qualifications` |
| User contact/identity | `phone_numbers`, `user_identifiers`, `user_documents`, `user_addresses` |
| Groups | `groups`, `group_members`, `group_rules`, `group_members_cached` |
| Admission | `enquiries`, `admission_applications`, `application_documents` |
| Certificates | `tc_register`, `certificate_templates`, `issued_certificates` |
| Compliance | `consent_records`, `privacy_notices` |
| Infrastructure | `tenant_sequences` |

Tables this module **references but does not own**:

| Table | Owner | How referenced |
|---|---|---|
| `users` | Auth Service | `user_id` FK on profiles, phones, identifiers, addresses |
| `memberships` | Auth Service | `membership_id` FK on domain profiles |
| `roles` | Auth Service | Referenced via memberships |
| `institutes` | Institute Service | `tenant_id` FK on all tenant-scoped tables |
| `standards` | Institute Service | FK on `student_academics` |
| `sections` | Institute Service | FK on `student_academics` |
| `academic_years` | Institute Service | FK on `student_academics` |

---

## 2. Platform-Level Tables (No RLS — Globally Scoped)

### 2.1 user_profiles

Extends the Auth Service's `users` table with personal information. Platform-level because a user's name, DOB, and gender don't change per institute.

```sql
CREATE TABLE user_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id),

  -- Personal
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100),
  gender            VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth     DATE,
  blood_group       VARCHAR(5) CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  nationality       VARCHAR(50) DEFAULT 'Indian',
  religion          VARCHAR(30),
  mother_tongue     VARCHAR(50),

  -- Images
  profile_image_url TEXT,
  cover_image_url   TEXT,

  -- Metadata
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id)
);

-- No RLS — platform-level, readable by all authenticated users.
-- Write access controlled by CASL (only self or admin can update).
```

**Why platform-level:** A teacher named "Anil Sharma" is "Anil Sharma" at every institute. Personal info doesn't vary per tenant. This avoids duplicating profiles across institutes.

### 2.2 phone_numbers

```sql
CREATE TABLE phone_numbers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  country_code      VARCHAR(5) NOT NULL DEFAULT '+91',
  number            VARCHAR(15) NOT NULL,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  is_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  label             VARCHAR(30),  -- 'Personal', 'Work', 'Home'

  CONSTRAINT uq_phone_global UNIQUE (country_code, number),
  CONSTRAINT uq_phone_user UNIQUE (user_id, country_code, number)
);

-- Partial unique: exactly one primary per user
CREATE UNIQUE INDEX idx_phone_numbers_primary
  ON phone_numbers (user_id) WHERE is_primary = true;
```

**Invariants:**
1. Exactly one phone must be `is_primary = true` per user (enforced by partial unique index).
2. `(country_code, number)` is globally unique — one phone number = one user account. Prevents duplicate registrations.
3. Indian mobile validation: `number` must be 10 digits starting with 6-9 when `country_code = '+91'`. Application-level validation.
4. WhatsApp messages sent to the phone(s) where `is_whatsapp_enabled = true`.

### 2.3 user_identifiers

Government-issued identity documents. Encrypted where required by DPDP Act.

```sql
CREATE TABLE user_identifiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              VARCHAR(30) NOT NULL,
    -- 'aadhaar', 'pan', 'passport', 'voter_id', 'driving_license',
    -- 'apaar', 'pen', 'cbse_registration', 'bseh_enrollment',
    -- 'shala_darpan_id', 'parivar_pehchan_patra', 'jan_aadhaar'
  value_encrypted   BYTEA,           -- AES-256-GCM encrypted value (for Aadhaar, PAN)
  value_hash        VARCHAR(64),     -- SHA-256 hash for lookup (for Aadhaar)
  value_plain       VARCHAR(50),     -- Unencrypted value (for non-sensitive: APAAR, PEN, registration numbers)
  value_masked      VARCHAR(20),     -- Display value: "XXXX-XXXX-4532" for Aadhaar
  issuing_authority VARCHAR(100),
  valid_from        DATE,
  valid_to          DATE,
  is_verified       BOOLEAN DEFAULT false,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES users(id),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_identifier_value CHECK (
    (value_encrypted IS NOT NULL AND value_hash IS NOT NULL AND value_masked IS NOT NULL)
    OR value_plain IS NOT NULL
  ),
  -- Only one identifier per type per user
  CONSTRAINT uq_identifier_type UNIQUE (user_id, type)
);

-- Aadhaar lookup by hash (for duplicate detection during admission)
CREATE INDEX idx_identifiers_aadhaar_hash
  ON user_identifiers (value_hash) WHERE type = 'aadhaar';
```

**Encryption rules:**
- `aadhaar`, `pan`: MUST use `value_encrypted` + `value_hash` + `value_masked`. `value_plain` must be NULL.
- `apaar`, `pen`, `cbse_registration`, `bseh_enrollment`, `shala_darpan_id`, `parivar_pehchan_patra`, `jan_aadhaar`, `passport`, `voter_id`, `driving_license`: Use `value_plain`. `value_encrypted` must be NULL.
- Application-level enforcement via value objects: `EncryptedIdentifier` and `PlainIdentifier`.

**Aadhaar validation:** 12 digits with Verhoeff checksum. Validate before encrypting.

### 2.4 user_documents

Uploaded scans/photos of identity documents.

```sql
CREATE TABLE user_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              VARCHAR(50) NOT NULL,
    -- 'birth_certificate', 'tc_incoming', 'report_card', 'aadhaar_card',
    -- 'caste_certificate', 'income_certificate', 'ews_certificate',
    -- 'medical_certificate', 'disability_certificate', 'address_proof',
    -- 'passport_photo', 'family_photo', 'bpl_card', 'transfer_order',
    -- 'noc', 'affidavit', 'other'
  description       VARCHAR(255),
  file_urls         TEXT[] NOT NULL,    -- Array of S3/MinIO URLs
  reference_number  VARCHAR(100),       -- Document's own reference number
  is_verified       BOOLEAN DEFAULT false,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES users(id),
  rejection_reason  VARCHAR(255),
  expiry_date       DATE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_documents_user ON user_documents (user_id, type);
```

### 2.5 user_addresses

```sql
CREATE TABLE user_addresses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              VARCHAR(20) NOT NULL CHECK (type IN ('permanent', 'current', 'emergency')),
  line1             VARCHAR(255) NOT NULL,
  line2             VARCHAR(255),
  line3             VARCHAR(255),
  city              VARCHAR(100) NOT NULL,
  district          VARCHAR(100),       -- Essential for Indian government reporting (UDISE+, Shala Darpan)
  state             VARCHAR(100) NOT NULL,
  country           VARCHAR(50) NOT NULL DEFAULT 'India',
  postal_code       VARCHAR(10) NOT NULL,
  coordinates       JSONB,              -- { lat, lng } for OASIS geo-tagging

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_address_type UNIQUE (user_id, type)
);
```

---

## 3. Tenant-Scoped Profile Tables (RLS Enforced)

All tables in this section follow the three-tier RLS pattern from Auth PRD §9:
- `roviq_app`: tenant-scoped CRUD via `app.current_tenant_id`
- `roviq_reseller`: read-only across their reseller's institutes
- `roviq_admin`: full access via `USING (true)`
- `FORCE ROW LEVEL SECURITY` on every table

All tables include `entityColumns`: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, `version`.

### 3.1 student_profiles

Domain data for students. One row per membership (one student per institute).

```sql
CREATE TABLE student_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  membership_id     UUID NOT NULL UNIQUE REFERENCES memberships(id),
  user_id           UUID NOT NULL REFERENCES users(id),

  -- Admission
  admission_number  VARCHAR(30) NOT NULL,
  admission_date    DATE NOT NULL,
  admission_class   VARCHAR(20),        -- Class at time of first admission (e.g., 'Nursery', 'Class 5')
  admission_type    VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (admission_type IN ('new', 'rte', 'lateral_entry', 're_admission', 'transfer')),

  -- Academic status
  academic_status   VARCHAR(20) NOT NULL DEFAULT 'enrolled'
                    CHECK (academic_status IN (
                      'enrolled', 'promoted', 'detained', 'graduated',
                      'transferred_out', 'dropped_out', 'withdrawn', 'suspended', 'expelled',
                      're_enrolled', 'passout'
                    )),

  -- Regulatory
  social_category   VARCHAR(10) NOT NULL DEFAULT 'general'
                    CHECK (social_category IN ('general', 'sc', 'st', 'obc', 'ews')),
  caste             VARCHAR(100),       -- Specific caste name (separate from category). TC field.
  is_minority       BOOLEAN NOT NULL DEFAULT false,
  minority_type     VARCHAR(20) CHECK (minority_type IN (
                      'muslim', 'christian', 'sikh', 'buddhist', 'parsi', 'jain', 'other'
                    )),
  is_bpl            BOOLEAN NOT NULL DEFAULT false,
  is_cwsn           BOOLEAN NOT NULL DEFAULT false,
  cwsn_type         VARCHAR(60),        -- Per RPWD Act 2016 (21 categories). NULL if is_cwsn = false.
  is_rte_admitted   BOOLEAN NOT NULL DEFAULT false,
  rte_certificate   VARCHAR(50),        -- EWS/DG certificate number

  -- Previous school (for TC verification and lateral entry)
  previous_school_name   VARCHAR(255),
  previous_school_board  VARCHAR(50),    -- CBSE, ICSE, state board name
  previous_school_udise  CHAR(11),       -- 11-digit UDISE+ code
  incoming_tc_number     VARCHAR(50),    -- TC number from previous school
  incoming_tc_date       DATE,

  -- TC outgoing
  tc_issued         BOOLEAN NOT NULL DEFAULT false,
  tc_number         VARCHAR(50),
  tc_issued_date    DATE,
  tc_reason         VARCHAR(100),
  date_of_leaving   DATE,

  -- Stream (Class 11-12)
  stream            VARCHAR(20) CHECK (stream IN ('science_pcm', 'science_pcb', 'commerce', 'arts', 'vocational')),

  -- Coaching-specific (NULL for schools)
  batch_start_date  DATE,
  batch_end_date    DATE,
  course_name       VARCHAR(100),

  -- Medical
  medical_info      JSONB,              -- { allergies: [], conditions: [], medications: [], emergency_contact: {} }

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_student_admission_no UNIQUE (tenant_id, admission_number) -- Partial: WHERE deleted_at IS NULL
);

-- Partial unique: admission number unique among non-deleted students per tenant
CREATE UNIQUE INDEX idx_student_admission_no_active
  ON student_profiles (tenant_id, admission_number) WHERE deleted_at IS NULL;

-- Search
CREATE INDEX idx_student_profiles_tenant ON student_profiles (tenant_id, academic_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_profiles_membership ON student_profiles (membership_id);
```

### 3.2 student_academics

One row per student per academic year. Tracks section placement, roll number, house assignment.

```sql
CREATE TABLE student_academics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  student_profile_id UUID NOT NULL REFERENCES student_profiles(id),
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  standard_id       UUID NOT NULL REFERENCES standards(id),
  section_id        UUID NOT NULL REFERENCES sections(id),
  roll_number       VARCHAR(10),
  house_id          UUID,               -- FK to houses (future module). Nullable.
  route_id          UUID,               -- FK to transport routes (future module). Nullable.
  class_roles       JSONB DEFAULT '[]', -- ['class_monitor', 'prefect', 'house_captain', ...]
  promotion_status  VARCHAR(20) CHECK (promotion_status IN (
                      'pending', 'promoted', 'detained', 'graduated', 'transferred'
                    )),
  promoted_to_standard_id UUID,         -- Where promoted to. NULL if pending.

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_student_academic UNIQUE (student_profile_id, academic_year_id)
);

CREATE INDEX idx_student_academics_lookup
  ON student_academics (tenant_id, academic_year_id, section_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_academics_standard
  ON student_academics (tenant_id, academic_year_id, standard_id) WHERE deleted_at IS NULL;
```

### 3.3 student_guardian_links

Junction table linking students to guardians. Bidirectional querying.

```sql
CREATE TABLE student_guardian_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  student_profile_id UUID NOT NULL REFERENCES student_profiles(id),
  guardian_profile_id UUID NOT NULL REFERENCES guardian_profiles(id),
  relationship      VARCHAR(30) NOT NULL
                    CHECK (relationship IN (
                      'father', 'mother', 'legal_guardian', 'grandparent_paternal',
                      'grandparent_maternal', 'uncle', 'aunt', 'sibling', 'other'
                    )),
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT false,
  can_pickup        BOOLEAN NOT NULL DEFAULT true,  -- Authorized for school pickup
  lives_with        BOOLEAN NOT NULL DEFAULT true,  -- Student resides with this guardian

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_student_guardian UNIQUE (student_profile_id, guardian_profile_id)
);

-- Exactly one primary contact per student
CREATE UNIQUE INDEX idx_primary_contact
  ON student_guardian_links (student_profile_id) WHERE is_primary_contact = true;

-- Find all students of a guardian (sibling discovery, parent dashboard)
CREATE INDEX idx_guardian_students
  ON student_guardian_links (guardian_profile_id);
```

### 3.4 staff_profiles

```sql
CREATE TABLE staff_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  membership_id     UUID NOT NULL UNIQUE REFERENCES memberships(id),
  user_id           UUID NOT NULL REFERENCES users(id),

  employee_id       VARCHAR(30),        -- Institute-assigned staff ID
  designation       VARCHAR(100),       -- 'PGT Physics', 'TGT Mathematics', 'PRT', 'Lab Assistant'
  department        VARCHAR(50),        -- 'Science', 'Commerce', 'Arts', 'Administration', 'Support'
  date_of_joining   DATE,
  date_of_leaving   DATE,
  leaving_reason    VARCHAR(100),

  -- Employment
  employment_type   VARCHAR(20) DEFAULT 'regular'
                    CHECK (employment_type IN ('regular', 'contractual', 'part_time', 'guest', 'volunteer')),
  is_class_teacher  BOOLEAN NOT NULL DEFAULT false,

  -- UDISE+ teacher fields
  trained_for_cwsn  BOOLEAN NOT NULL DEFAULT false,
  nature_of_appointment VARCHAR(30),    -- 'permanent', 'temporary', 'adhoc', 'probation'

  -- Coaching-specific
  specialization    VARCHAR(100),       -- 'JEE Physics', 'NEET Biology'

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_staff_profiles_tenant ON staff_profiles (tenant_id) WHERE deleted_at IS NULL;
```

### 3.5 staff_qualifications

Structured qualifications instead of `string[]`.

```sql
CREATE TABLE staff_qualifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id  UUID NOT NULL REFERENCES staff_profiles(id),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  type              VARCHAR(20) NOT NULL CHECK (type IN ('academic', 'professional')),
    -- academic: 'Below Secondary', 'Secondary', 'Higher Secondary', 'Graduate', 'Post Graduate', 'M.Phil', 'Ph.D'
    -- professional: 'D.El.Ed', 'B.Ed', 'M.Ed', 'CTET', 'HTET', 'REET', 'NET', 'SLET'
  degree_name       VARCHAR(100) NOT NULL,
  institution       VARCHAR(200),
  board_university  VARCHAR(200),
  year_of_passing   INTEGER,
  grade_percentage  VARCHAR(20),        -- '85%' or 'First Division' or 'A+'
  certificate_url   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.6 guardian_profiles

```sql
CREATE TABLE guardian_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  membership_id     UUID NOT NULL UNIQUE REFERENCES memberships(id),
  user_id           UUID NOT NULL REFERENCES users(id),

  occupation        VARCHAR(100),
  organization      VARCHAR(200),       -- Employer name
  designation       VARCHAR(100),       -- Job title
  annual_income     BIGINT,             -- In paise (for RTE eligibility verification)
  education_level   VARCHAR(50),        -- 'illiterate', 'primary', 'secondary', 'graduate', 'post_graduate', 'professional'

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_guardian_profiles_tenant ON guardian_profiles (tenant_id) WHERE deleted_at IS NULL;
```

### 3.7 bot_profiles

```sql
CREATE TABLE bot_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  membership_id     UUID NOT NULL UNIQUE REFERENCES memberships(id),
  user_id           UUID NOT NULL REFERENCES users(id),

  bot_type          VARCHAR(30) NOT NULL
                    CHECK (bot_type IN (
                      'system_notification', 'fee_reminder', 'attendance_notification',
                      'homework_reminder', 'ai_chatbot_parent', 'ai_chatbot_student',
                      'integration', 'report_generation', 'bulk_operation', 'admission_chatbot'
                    )),
  api_key_hash      TEXT,               -- Argon2id hash
  api_key_prefix    VARCHAR(12),        -- 'skbot_' + first 8 chars for identification
  api_key_expires_at TIMESTAMPTZ,
  last_active_at    TIMESTAMPTZ,
  rate_limit_tier   VARCHAR(10) DEFAULT 'low' CHECK (rate_limit_tier IN ('low', 'medium', 'high')),
  config            JSONB DEFAULT '{}', -- Bot-specific: schedule, templates, AI config, allowed data scopes
  webhook_url       TEXT,
  is_system_bot     BOOLEAN NOT NULL DEFAULT false, -- Cross-tenant platform bots
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deactivated')),

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1
);
```

---

## 4. Group Tables

### 4.1 groups

```sql
CREATE TABLE groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  group_type        VARCHAR(20) NOT NULL
                    CHECK (group_type IN (
                      'class', 'section', 'house', 'club', 'sports_team', 'bus_route',
                      'subject', 'stream', 'fee', 'exam', 'notification', 'activity',
                      'department', 'committee', 'composite', 'custom'
                    )),
  membership_type   VARCHAR(10) NOT NULL DEFAULT 'dynamic'
                    CHECK (membership_type IN ('static', 'dynamic', 'hybrid')),
  member_types      TEXT[] NOT NULL DEFAULT '{student}',
    -- Which user types can be members: {'student'}, {'staff'}, {'student','staff','guardian'}, etc.
  is_system         BOOLEAN NOT NULL DEFAULT false, -- Auto-created groups (e.g., per-section groups)
  status            VARCHAR(10) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'archived')),
  resolved_at       TIMESTAMPTZ,        -- Last time membership was resolved
  member_count      INTEGER DEFAULT 0,  -- Denormalized count from last resolution

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_group_name UNIQUE (tenant_id, name) -- Partial: WHERE deleted_at IS NULL
);

CREATE UNIQUE INDEX idx_group_name_active
  ON groups (tenant_id, name) WHERE deleted_at IS NULL;
```

### 4.2 group_rules

Dynamic membership rules stored as JsonLogic JSONB.

```sql
CREATE TABLE group_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES groups(id),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  rule              JSONB NOT NULL,     -- JsonLogic format
  rule_dimensions   TEXT[] NOT NULL,    -- ['standard', 'section', 'gender', 'stream', ...]
    -- Used for targeted invalidation: only recalculate if changed dimension is in this list.
  description       TEXT,               -- Human-readable: "All female students in Class 10 Science"

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3 group_members

Static members (manually added) + cached resolved members from dynamic rules.

```sql
CREATE TABLE group_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES groups(id),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  membership_id     UUID NOT NULL REFERENCES memberships(id),
  source            VARCHAR(10) NOT NULL CHECK (source IN ('manual', 'rule', 'inherited')),
    -- manual: explicitly added. rule: resolved from group_rules. inherited: from parent group.
  is_excluded       BOOLEAN NOT NULL DEFAULT false,
    -- For hybrid groups: manually excluded even though rules match.
  resolved_at       TIMESTAMPTZ,

  CONSTRAINT uq_group_member UNIQUE (group_id, membership_id)
);

CREATE INDEX idx_group_members_group ON group_members (group_id) WHERE is_excluded = false;
CREATE INDEX idx_group_members_membership ON group_members (membership_id);
```

### 4.4 Parent-child group relationships (composite groups)

```sql
-- groups.parent_group_id for simple hierarchy (optional, nullable)
ALTER TABLE groups ADD COLUMN parent_group_id UUID REFERENCES groups(id);

-- For composite groups that combine multiple child groups
CREATE TABLE group_children (
  parent_group_id   UUID NOT NULL REFERENCES groups(id),
  child_group_id    UUID NOT NULL REFERENCES groups(id),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),

  PRIMARY KEY (parent_group_id, child_group_id),
  CONSTRAINT chk_no_self_ref CHECK (parent_group_id != child_group_id)
);
```

---

## 5. Admission Tables

### 5.1 enquiries

```sql
CREATE TABLE enquiries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),

  -- Student info (pre-admission, may not have a user yet)
  student_name      VARCHAR(200) NOT NULL,
  date_of_birth     DATE,
  gender            VARCHAR(10),
  class_requested   VARCHAR(20) NOT NULL,  -- 'Nursery', 'LKG', 'Class 5', etc.
  academic_year_id  UUID REFERENCES academic_years(id),

  -- Parent info
  parent_name       VARCHAR(200) NOT NULL,
  parent_phone      VARCHAR(15) NOT NULL,
  parent_email      VARCHAR(320),
  parent_relation   VARCHAR(30) DEFAULT 'father',

  -- Enquiry metadata
  source            VARCHAR(30) NOT NULL DEFAULT 'walk_in'
                    CHECK (source IN (
                      'walk_in', 'phone', 'website', 'social_media', 'referral',
                      'newspaper_ad', 'hoarding', 'school_event', 'alumni', 'google', 'whatsapp', 'other'
                    )),
  referred_by       VARCHAR(200),
  assigned_to       UUID REFERENCES users(id),  -- Counsellor / front desk staff
  previous_school   VARCHAR(255),
  previous_board    VARCHAR(50),
  sibling_in_school BOOLEAN DEFAULT false,
  sibling_admission_no VARCHAR(30),
  special_needs     TEXT,
  notes             TEXT,

  -- Status
  status            VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (status IN (
                      'new', 'contacted', 'campus_visit_scheduled', 'campus_visited',
                      'application_issued', 'application_submitted', 'test_scheduled',
                      'offer_made', 'fee_paid', 'enrolled', 'lost', 'dropped'
                    )),
  follow_up_date    DATE,
  last_contacted_at TIMESTAMPTZ,

  -- Conversion
  converted_to_application_id UUID,  -- FK to admission_applications (set when converted)

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_enquiries_status ON enquiries (tenant_id, status, follow_up_date) WHERE deleted_at IS NULL;
```

### 5.2 admission_applications

Formal application after enquiry conversion or direct application.

```sql
CREATE TABLE admission_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  enquiry_id        UUID REFERENCES enquiries(id),  -- Nullable for direct applications
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  standard_id       UUID NOT NULL REFERENCES standards(id),
  section_id        UUID REFERENCES sections(id),    -- Nullable until section assigned

  -- Application form data (JSONB — varies by institute)
  form_data         JSONB NOT NULL DEFAULT '{}',
    -- Structured per institute's admission form config.
    -- Contains: student personal info, parent info, academic history, etc.

  -- Status
  status            VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN (
                      'draft', 'submitted', 'documents_pending', 'documents_verified',
                      'test_scheduled', 'test_completed', 'interview_scheduled', 'interview_completed',
                      'merit_listed', 'offer_made', 'offer_accepted', 'fee_pending',
                      'fee_paid', 'enrolled', 'waitlisted', 'rejected', 'withdrawn', 'expired'
                    )),

  -- RTE specific
  is_rte_application BOOLEAN NOT NULL DEFAULT false,
  rte_lottery_rank  INTEGER,

  -- Test/Interview
  test_score        DECIMAL(5,2),
  interview_score   DECIMAL(5,2),
  merit_rank        INTEGER,

  -- Offer
  offered_at        TIMESTAMPTZ,
  offer_expires_at  TIMESTAMPTZ,
  offer_accepted_at TIMESTAMPTZ,

  -- Conversion to student
  student_profile_id UUID REFERENCES student_profiles(id),  -- Set after enrollment

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1
);
```

### 5.3 application_documents

Documents submitted with an application.

```sql
CREATE TABLE application_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES admission_applications(id),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  type              VARCHAR(50) NOT NULL,  -- Same enum as user_documents.type
  file_urls         TEXT[] NOT NULL,
  is_verified       BOOLEAN DEFAULT false,
  verified_by       UUID REFERENCES users(id),
  verified_at       TIMESTAMPTZ,
  rejection_reason  VARCHAR(255),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Certificate Tables

### 6.1 tc_register

```sql
CREATE TABLE tc_register (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  student_profile_id UUID NOT NULL REFERENCES student_profiles(id),
  tc_serial_number  VARCHAR(50) NOT NULL,  -- 'TC/2025-26/001'
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),

  -- Status workflow
  status            VARCHAR(20) NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested', 'clearance_pending', 'clearance_complete',
                      'generated', 'review_pending', 'approved', 'issued',
                      'cancelled', 'duplicate_requested', 'duplicate_issued'
                    )),

  -- TC data (auto-populated from student record, snapshot at time of generation)
  tc_data           JSONB NOT NULL DEFAULT '{}',
    -- All 20+ CBSE fields: name, parents, DOB, nationality, category, admission date,
    -- class, subjects, result, dues status, attendance, conduct, NCC, reason, etc.

  -- Workflow
  requested_by      UUID REFERENCES users(id),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason            VARCHAR(200) NOT NULL,
  clearances        JSONB DEFAULT '{}',
    -- { accounts: { cleared: true, by: 'uuid', at: 'timestamp' },
    --   library: { cleared: true, by: 'uuid', at: 'timestamp' },
    --   lab: { cleared: false }, transport: { cleared: true, ... } }
  generated_at      TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),  -- Must be Principal
  approved_at       TIMESTAMPTZ,
  issued_at         TIMESTAMPTZ,
  issued_to         VARCHAR(200),       -- Name of person who collected TC

  -- Digital
  pdf_url           TEXT,
  qr_verification_url TEXT,             -- '{school-domain}/tc/verify/{tc_serial_number}'
  is_counter_signed BOOLEAN DEFAULT false,
  counter_signed_by VARCHAR(200),

  -- Duplicate
  is_duplicate      BOOLEAN NOT NULL DEFAULT false,
  original_tc_id    UUID REFERENCES tc_register(id),
  duplicate_reason  TEXT,
  duplicate_fee     BIGINT,             -- In paise

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_tc_serial UNIQUE (tenant_id, tc_serial_number)
);
```

### 6.2 certificate_templates

Configurable templates for all certificate types.

```sql
CREATE TABLE certificate_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  type              VARCHAR(30) NOT NULL
                    CHECK (type IN (
                      'transfer_certificate', 'character_certificate', 'bonafide_certificate',
                      'school_leaving_certificate', 'study_certificate', 'dob_certificate',
                      'no_dues_certificate', 'railway_concession', 'attendance_certificate',
                      'conduct_certificate', 'sports_certificate', 'merit_certificate',
                      'provisional_certificate', 'custom'
                    )),
  name              VARCHAR(200) NOT NULL,
  template_content  TEXT,               -- HTML/Handlebars template for PDF generation
  fields_schema     JSONB NOT NULL,     -- JSON Schema defining required fields
  approval_chain    JSONB DEFAULT '[]', -- [{ role: 'class_teacher' }, { role: 'principal' }]
  is_active         BOOLEAN NOT NULL DEFAULT true,
  board_type        VARCHAR(20),        -- 'cbse', 'bseh', 'rbse', null for custom

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.3 issued_certificates

```sql
CREATE TABLE issued_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  template_id       UUID NOT NULL REFERENCES certificate_templates(id),
  student_profile_id UUID REFERENCES student_profiles(id),
  staff_profile_id  UUID REFERENCES staff_profiles(id),
  serial_number     VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_approval', 'approved', 'issued', 'cancelled')),
  certificate_data  JSONB NOT NULL,     -- Populated fields
  pdf_url           TEXT,
  issued_date       DATE,
  issued_by         UUID REFERENCES users(id),
  purpose           VARCHAR(255),
  valid_until       DATE,

  -- entityColumns
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES users(id),
  version           INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_certificate_serial UNIQUE (tenant_id, serial_number)
);
```

---

## 7. Compliance Tables

### 7.1 consent_records

DPDP Act 2023 verifiable parental consent tracking.

```sql
CREATE TABLE consent_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  guardian_profile_id UUID NOT NULL REFERENCES guardian_profiles(id),
  student_profile_id UUID NOT NULL REFERENCES student_profiles(id),
  purpose           VARCHAR(50) NOT NULL
                    CHECK (purpose IN (
                      'academic_data_processing',   -- Grades, attendance, enrollment
                      'photo_video_marketing',      -- Website, social media, brochures
                      'whatsapp_communication',     -- WhatsApp messages to parent
                      'sms_communication',          -- SMS alerts
                      'aadhaar_collection',         -- Collecting and storing Aadhaar
                      'biometric_collection',       -- Fingerprint/face (if used)
                      'third_party_edtech',         -- Sharing with EdTech tools
                      'board_exam_registration',    -- Sharing with CBSE/BSEH/RBSE
                      'transport_tracking',         -- GPS tracking during commute
                      'health_data_processing',     -- Medical records
                      'cctv_monitoring'             -- Campus CCTV
                    )),
  is_granted        BOOLEAN NOT NULL,
  granted_at        TIMESTAMPTZ,
  withdrawn_at      TIMESTAMPTZ,
  verification_method VARCHAR(30)
                    CHECK (verification_method IN (
                      'digilocker_token', 'aadhaar_otp', 'in_person_id_check',
                      'signed_form_uploaded', 'school_erp_verified_account'
                    )),
  verification_reference VARCHAR(100),  -- DigiLocker token ID, OTP transaction ID, etc.
  ip_address        INET,
  user_agent        TEXT,
  privacy_notice_id UUID REFERENCES privacy_notices(id),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_guardian ON consent_records (guardian_profile_id, purpose);
CREATE INDEX idx_consent_student ON consent_records (student_profile_id, purpose);
```

### 7.2 privacy_notices

```sql
CREATE TABLE privacy_notices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  version           INTEGER NOT NULL,
  language          VARCHAR(10) NOT NULL DEFAULT 'en',  -- 'en', 'hi', 'ur', etc.
  content           TEXT NOT NULL,       -- Full text of the privacy notice
  is_active         BOOLEAN NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notice_version UNIQUE (tenant_id, version, language)
);
```

---

## 8. Infrastructure Tables

### 8.1 tenant_sequences

Atomic sequential number generation. Replaces the `COUNT(*) + 1` race condition from the old system.

```sql
CREATE TABLE tenant_sequences (
  tenant_id         UUID NOT NULL REFERENCES institutes(id),
  sequence_name     VARCHAR(80) NOT NULL,
    -- 'adm_no', 'roll_no:{section_id}:{academic_year_id}', 'tc_no:{academic_year_id}',
    -- 'cert_no:{type}:{academic_year_id}', 'enquiry_no'
  current_value     BIGINT NOT NULL DEFAULT 0,
  prefix            VARCHAR(20),          -- 'N-' for Nursery, 'L-' for LKG, '' for regular
  format_template   VARCHAR(50),          -- '{prefix}{year}/{value:04d}' → 'N-2025/0001'

  PRIMARY KEY (tenant_id, sequence_name)
);

-- Atomic increment function
-- Usage: SELECT next_sequence_value('tenant-uuid', 'adm_no')
CREATE FUNCTION next_sequence_value(p_tenant_id UUID, p_sequence_name VARCHAR)
RETURNS TABLE (next_val BIGINT, formatted VARCHAR) AS $$
  UPDATE tenant_sequences
  SET current_value = current_value + 1
  WHERE tenant_id = p_tenant_id AND sequence_name = p_sequence_name
  RETURNING current_value, REPLACE(
    REPLACE(format_template, '{value:04d}', LPAD(current_value::text, 4, '0')),
    '{prefix}', COALESCE(prefix, '')
  );
$$ LANGUAGE SQL;
```

**Admission number prefix rules:**
- Nursery: prefix `N-` → `N-2025/0001`
- LKG: prefix `L-` → `L-2025/0002`
- UKG: prefix `U-` → `U-2025/0003`
- Class 1: prefix `A-` (some schools) or no prefix → `2025/0004`
- Class 2+: no prefix → `2025/0005`
- Configurable per institute via `institute_configs.admission_number_config` JSONB.

---

## 9. Full-Text Search Indexes

```sql
-- Student search (name + admission number)
ALTER TABLE user_profiles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name, '')), 'B')
  ) STORED;

CREATE INDEX idx_user_profiles_search ON user_profiles USING GIN (search_vector);

-- Admission number trigram search (for typeahead)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_student_admission_trgm
  ON student_profiles USING GIN (admission_number gin_trgm_ops);

-- Enquiry search
CREATE INDEX idx_enquiry_search
  ON enquiries USING GIN (
    to_tsvector('simple', coalesce(student_name, '') || ' ' || coalesce(parent_name, ''))
  );
```
