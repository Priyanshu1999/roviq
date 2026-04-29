-- M3: Staff, guardian, and student-guardian-link tables — CREATE, RLS, FORCE, GRANTs (ROV-156)

-- ── 1. staff_profiles ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "user_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL UNIQUE,
  "employee_id" varchar(30),
  "designation" varchar(100),
  "department" varchar(50),
  "date_of_joining" date,
  "date_of_leaving" date,
  "leaving_reason" varchar(100),
  "employment_type" varchar(20) DEFAULT 'regular',
  "is_class_teacher" boolean NOT NULL DEFAULT false,
  "trained_for_cwsn" boolean NOT NULL DEFAULT false,
  "nature_of_appointment" varchar(30),
  "social_category" varchar(10),
  "is_disabled" boolean NOT NULL DEFAULT false,
  "disability_type" varchar(60),
  "specialization" varchar(100),
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_employment_type" CHECK ("employment_type" IS NULL OR "employment_type" IN ('regular', 'contractual', 'part_time', 'guest', 'volunteer')),
  CONSTRAINT "chk_staff_social_category" CHECK ("social_category" IS NULL OR "social_category" IN ('general', 'sc', 'st', 'obc', 'ews'))
);

ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE INDEX IF NOT EXISTS "idx_staff_profiles_tenant" ON "staff_profiles" ("tenant_id") WHERE "deleted_at" IS NULL;

-- ── 2. staff_qualifications ─────────────────────────────
CREATE TABLE IF NOT EXISTS "staff_qualifications" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "staff_profile_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "type" varchar(20) NOT NULL,
  "degree_name" varchar(100) NOT NULL,
  "institution" varchar(200),
  "board_university" varchar(200),
  "year_of_passing" integer,
  "grade_percentage" varchar(20),
  "certificate_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_qualification_type" CHECK ("type" IN ('ACADEMIC', 'PROFESSIONAL'))
);

ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_staff_profile_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE INDEX IF NOT EXISTS "idx_staff_qualifications_profile" ON "staff_qualifications" ("staff_profile_id");

-- ── 3. guardian_profiles ────────────────────────────────
CREATE TABLE IF NOT EXISTS "guardian_profiles" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "user_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL UNIQUE,
  "occupation" varchar(100),
  "organization" varchar(200),
  "designation" varchar(100),
  "annual_income" bigint,
  "education_level" varchar(50),
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_education_level" CHECK ("education_level" IS NULL OR "education_level" IN ('illiterate', 'primary', 'secondary', 'graduate', 'post_graduate', 'professional'))
);

ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE INDEX IF NOT EXISTS "idx_guardian_profiles_tenant" ON "guardian_profiles" ("tenant_id") WHERE "deleted_at" IS NULL;

-- ── 4. student_guardian_links ───────────────────────────
CREATE TABLE IF NOT EXISTS "student_guardian_links" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "student_profile_id" uuid NOT NULL,
  "guardian_profile_id" uuid NOT NULL,
  "relationship" varchar(30) NOT NULL,
  "is_primary_contact" boolean NOT NULL DEFAULT false,
  "is_emergency_contact" boolean NOT NULL DEFAULT false,
  "can_pickup" boolean NOT NULL DEFAULT true,
  "lives_with" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_relationship" CHECK ("relationship" IN (
    'father', 'mother', 'legal_guardian', 'grandparent_paternal',
    'grandparent_maternal', 'uncle', 'aunt', 'sibling', 'other'
  ))
);

ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_guardian_profile_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "guardian_profiles"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_student_guardian" ON "student_guardian_links" ("student_profile_id", "guardian_profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_primary_contact" ON "student_guardian_links" ("student_profile_id") WHERE "is_primary_contact" = true;
CREATE INDEX IF NOT EXISTS "idx_guardian_students" ON "student_guardian_links" ("guardian_profile_id");

-- ── 5. ENABLE + FORCE ROW LEVEL SECURITY ────────────────
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "staff_qualifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_qualifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "guardian_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "student_guardian_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_guardian_links" FORCE ROW LEVEL SECURITY;

-- ── 6. RLS Policies — staff_profiles ────────────────────
CREATE POLICY "staff_profiles_app_select" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_profiles_app_insert" ON "staff_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_profiles_app_update" ON "staff_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_profiles_app_delete" ON "staff_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "staff_profiles_reseller_read" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "staff_profiles_admin_all" ON "staff_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 7. RLS Policies — staff_qualifications ──────────────
CREATE POLICY "staff_qualifications_app_select" ON "staff_qualifications" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_qualifications_app_insert" ON "staff_qualifications" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_qualifications_app_update" ON "staff_qualifications" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "staff_qualifications_app_delete" ON "staff_qualifications" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "staff_qualifications_reseller_read" ON "staff_qualifications" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "staff_qualifications_admin_all" ON "staff_qualifications" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 8. RLS Policies — guardian_profiles ─────────────────
CREATE POLICY "guardian_profiles_app_select" ON "guardian_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "guardian_profiles_app_insert" ON "guardian_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "guardian_profiles_app_update" ON "guardian_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "guardian_profiles_app_delete" ON "guardian_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "guardian_profiles_reseller_read" ON "guardian_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "guardian_profiles_admin_all" ON "guardian_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 9. RLS Policies — student_guardian_links ────────────
CREATE POLICY "student_guardian_links_app_select" ON "student_guardian_links" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_guardian_links_app_insert" ON "student_guardian_links" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_guardian_links_app_update" ON "student_guardian_links" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_guardian_links_app_delete" ON "student_guardian_links" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "student_guardian_links_reseller_read" ON "student_guardian_links" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "student_guardian_links_admin_all" ON "student_guardian_links" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 10. GRANTs ──────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON staff_profiles TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON staff_qualifications TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON guardian_profiles TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON student_guardian_links TO roviq_app;

GRANT SELECT ON staff_profiles TO roviq_reseller;
GRANT SELECT ON staff_qualifications TO roviq_reseller;
GRANT SELECT ON guardian_profiles TO roviq_reseller;
GRANT SELECT ON student_guardian_links TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON staff_profiles TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_qualifications TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_profiles TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_guardian_links TO roviq_admin;
