-- M5: Certificate tables — tc_register, certificate_templates, issued_certificates
-- CREATE, RLS, FORCE, GRANTs

-- ── 1. tc_register ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tc_register" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "student_profile_id" uuid NOT NULL,
  "tc_serial_number" varchar(50) NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'requested',
  "tc_data" jsonb NOT NULL DEFAULT '{}',
  "requested_by" uuid,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" varchar(200) NOT NULL,
  "clearances" jsonb DEFAULT '{}',
  "generated_at" timestamp with time zone,
  "reviewed_by" uuid,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "issued_to" varchar(200),
  "pdf_url" text,
  "qr_verification_url" text,
  "is_counter_signed" boolean DEFAULT false,
  "counter_signed_by" varchar(200),
  "is_duplicate" boolean NOT NULL DEFAULT false,
  "original_tc_id" uuid,
  "duplicate_reason" text,
  "duplicate_fee" bigint,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_tc_status" CHECK ("status" IN (
    'requested', 'clearance_pending', 'clearance_complete',
    'generated', 'review_pending', 'approved', 'issued',
    'cancelled', 'duplicate_requested', 'duplicate_issued'
  ))
);

ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_requested_by_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_approved_by_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_original_tc_id_fk" FOREIGN KEY ("original_tc_id") REFERENCES "tc_register"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tc_serial" ON "tc_register" ("tenant_id", "tc_serial_number");
CREATE INDEX IF NOT EXISTS "idx_tc_register_tenant_status" ON "tc_register" ("tenant_id", "status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_tc_register_student" ON "tc_register" ("student_profile_id");

-- ── 2. certificate_templates ────────────────────────────────
CREATE TABLE IF NOT EXISTS "certificate_templates" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "type" varchar(30) NOT NULL,
  "name" varchar(200) NOT NULL,
  "template_content" text,
  "fields_schema" jsonb NOT NULL,
  "approval_chain" jsonb DEFAULT '[]',
  "is_active" boolean NOT NULL DEFAULT true,
  "board_type" varchar(20),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_certificate_type" CHECK ("type" IN (
    'transfer_certificate', 'character_certificate', 'bonafide_certificate',
    'school_leaving_certificate', 'study_certificate', 'dob_certificate',
    'no_dues_certificate', 'railway_concession', 'attendance_certificate',
    'conduct_certificate', 'sports_certificate', 'merit_certificate',
    'provisional_certificate', 'custom'
  ))
);

ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

-- ── 3. issued_certificates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "issued_certificates" (
  "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "template_id" uuid NOT NULL,
  "student_profile_id" uuid,
  "staff_profile_id" uuid,
  "serial_number" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "certificate_data" jsonb NOT NULL,
  "pdf_url" text,
  "issued_date" date,
  "issued_by" uuid,
  "purpose" varchar(255),
  "valid_until" date,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_certificate_status" CHECK ("status" IN ('draft', 'pending_approval', 'approved', 'issued', 'cancelled'))
);

ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_staff_profile_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_issued_by_fk" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_certificate_serial" ON "issued_certificates" ("tenant_id", "serial_number");
CREATE INDEX IF NOT EXISTS "idx_issued_certificates_student" ON "issued_certificates" ("student_profile_id");
CREATE INDEX IF NOT EXISTS "idx_issued_certificates_staff" ON "issued_certificates" ("staff_profile_id");
CREATE INDEX IF NOT EXISTS "idx_issued_certificates_tenant_status" ON "issued_certificates" ("tenant_id", "status") WHERE "deleted_at" IS NULL;

-- ── 4. ENABLE + FORCE ROW LEVEL SECURITY ──────────────────
ALTER TABLE "tc_register" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tc_register" FORCE ROW LEVEL SECURITY;
ALTER TABLE "certificate_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificate_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "issued_certificates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issued_certificates" FORCE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — tc_register (tenantPolicies: 7 policies with deleted_at) ──
CREATE POLICY "tc_register_app_select" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "tc_register_app_select_trash" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "tc_register_app_insert" ON "tc_register" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tc_register_app_update" ON "tc_register" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tc_register_app_delete" ON "tc_register" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "tc_register_reseller_read" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "tc_register_admin_all" ON "tc_register" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 6. RLS Policies — certificate_templates (tenantPoliciesSimple: 6 policies, no deleted_at) ──
CREATE POLICY "certificate_templates_app_select" ON "certificate_templates" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "certificate_templates_app_insert" ON "certificate_templates" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "certificate_templates_app_update" ON "certificate_templates" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "certificate_templates_app_delete" ON "certificate_templates" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "certificate_templates_reseller_read" ON "certificate_templates" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "certificate_templates_admin_all" ON "certificate_templates" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 7. RLS Policies — issued_certificates (tenantPolicies: 7 policies with deleted_at) ──
CREATE POLICY "issued_certificates_app_select" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "issued_certificates_app_select_trash" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "issued_certificates_app_insert" ON "issued_certificates" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "issued_certificates_app_update" ON "issued_certificates" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "issued_certificates_app_delete" ON "issued_certificates" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "issued_certificates_reseller_read" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "issued_certificates_admin_all" ON "issued_certificates" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 8. GRANTs ─────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON tc_register TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON certificate_templates TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON issued_certificates TO roviq_app;

GRANT SELECT ON tc_register TO roviq_reseller;
GRANT SELECT ON certificate_templates TO roviq_reseller;
GRANT SELECT ON issued_certificates TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON tc_register TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_templates TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON issued_certificates TO roviq_admin;
