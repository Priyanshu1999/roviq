-- M2: Student profiles + academics — CREATE, RLS, FORCE, GRANTs (ROV-153)
-- Tenant-scoped tables with three-tier RLS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. student_profiles ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "student_profiles" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "user_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL UNIQUE,
  "admission_number" varchar(30) NOT NULL,
  "admission_date" date NOT NULL,
  "admission_class" varchar(20),
  "admission_type" varchar(20) NOT NULL DEFAULT 'NEW',
  "academic_status" varchar(20) NOT NULL DEFAULT 'ENROLLED',
  "social_category" varchar(10) NOT NULL DEFAULT 'general',
  "caste" varchar(100),
  "is_minority" boolean NOT NULL DEFAULT false,
  "minority_type" varchar(20),
  "is_bpl" boolean NOT NULL DEFAULT false,
  "is_cwsn" boolean NOT NULL DEFAULT false,
  "cwsn_type" varchar(60),
  "is_rte_admitted" boolean NOT NULL DEFAULT false,
  "rte_certificate" varchar(50),
  "previous_school_name" varchar(255),
  "previous_school_board" varchar(50),
  "previous_school_udise" char(11),
  "incoming_tc_number" varchar(50),
  "incoming_tc_date" date,
  "tc_issued" boolean NOT NULL DEFAULT false,
  "tc_number" varchar(50),
  "tc_issued_date" date,
  "tc_reason" varchar(100),
  "date_of_leaving" date,
  "stream" varchar(20),
  "batch_start_date" date,
  "batch_end_date" date,
  "course_name" varchar(100),
  "medical_info" jsonb,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_admission_type" CHECK ("admission_type" IN ('NEW', 'RTE', 'LATERAL_ENTRY', 'RE_ADMISSION', 'TRANSFER')),
  CONSTRAINT "chk_academic_status" CHECK ("academic_status" IN (
    'enrolled', 'promoted', 'detained', 'graduated',
    'TRANSFERRED_OUT', 'DROPPED_OUT', 'WITHDRAWN', 'SUSPENDED', 'EXPELLED',
    'RE_ENROLLED', 'PASSOUT'
  )),
  CONSTRAINT "chk_social_category" CHECK ("social_category" IN ('general', 'sc', 'st', 'obc', 'ews')),
  CONSTRAINT "chk_minority_type" CHECK ("minority_type" IS NULL OR "minority_type" IN (
    'muslim', 'christian', 'sikh', 'buddhist', 'parsi', 'jain', 'other'
  )),
  CONSTRAINT "chk_stream" CHECK ("stream" IS NULL OR "stream" IN (
    'science_pcm', 'science_pcb', 'commerce', 'arts', 'vocational'
  ))
);

ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_student_admission_no_active" ON "student_profiles" ("tenant_id", "admission_number") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_student_profiles_tenant_status" ON "student_profiles" ("tenant_id", "academic_status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_student_profiles_membership" ON "student_profiles" ("membership_id");
CREATE INDEX IF NOT EXISTS "idx_student_profiles_admission_trgm" ON "student_profiles" USING gin ("admission_number" gin_trgm_ops);

-- ── 2. student_academics ────────────────────────────────
CREATE TABLE IF NOT EXISTS "student_academics" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "student_profile_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "standard_id" uuid NOT NULL,
  "section_id" uuid NOT NULL,
  "roll_number" varchar(10),
  "house_id" uuid,
  "route_id" uuid,
  "class_roles" jsonb DEFAULT '[]',
  "promotion_status" varchar(20),
  "promoted_to_standard_id" uuid,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_promotion_status" CHECK ("promotion_status" IS NULL OR "promotion_status" IN (
    'PENDING', 'PROMOTED', 'DETAINED', 'GRADUATED', 'TRANSFERRED'
  ))
);

ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_standard_id_fk" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_promoted_to_standard_id_fk" FOREIGN KEY ("promoted_to_standard_id") REFERENCES "standards"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_student_academic_year" ON "student_academics" ("student_profile_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "idx_student_academics_section" ON "student_academics" ("tenant_id", "academic_year_id", "section_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_student_academics_standard" ON "student_academics" ("tenant_id", "academic_year_id", "standard_id") WHERE "deleted_at" IS NULL;

-- ── 3. ENABLE + FORCE ROW LEVEL SECURITY ────────────────
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "student_academics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_academics" FORCE ROW LEVEL SECURITY;

-- ── 4. RLS Policies — student_profiles ──────────────────
CREATE POLICY "student_profiles_app_select" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "student_profiles_app_select_trash" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "student_profiles_app_insert" ON "student_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_profiles_app_update" ON "student_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_profiles_app_delete" ON "student_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app"
  USING (false);
CREATE POLICY "student_profiles_reseller_read" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "student_profiles_admin_all" ON "student_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin"
  USING (true) WITH CHECK (true);

-- ── 5. RLS Policies — student_academics ─────────────────
CREATE POLICY "student_academics_app_select" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "student_academics_app_select_trash" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "student_academics_app_insert" ON "student_academics" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_academics_app_update" ON "student_academics" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "student_academics_app_delete" ON "student_academics" AS PERMISSIVE FOR DELETE TO "roviq_app"
  USING (false);
CREATE POLICY "student_academics_reseller_read" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "student_academics_admin_all" ON "student_academics" AS PERMISSIVE FOR ALL TO "roviq_admin"
  USING (true) WITH CHECK (true);

-- ── 6. GRANTs ───────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON student_profiles TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON student_academics TO roviq_app;

GRANT SELECT ON student_profiles TO roviq_reseller;
GRANT SELECT ON student_academics TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON student_profiles TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_academics TO roviq_admin;
