-- M4: Admission tables — enquiries, admission_applications, application_documents
-- CREATE, RLS, FORCE, GRANTs

-- ── 1. enquiries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "enquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_name" varchar(200) NOT NULL,
  "date_of_birth" date,
  "gender" varchar(10),
  "class_requested" varchar(20) NOT NULL,
  "academic_year_id" uuid,
  "parent_name" varchar(200) NOT NULL,
  "parent_phone" varchar(15) NOT NULL,
  "parent_email" varchar(320),
  "parent_relation" varchar(30) DEFAULT 'father',
  "source" varchar(30) NOT NULL DEFAULT 'walk_in',
  "referred_by" varchar(200),
  "assigned_to" uuid,
  "previous_school" varchar(255),
  "previous_board" varchar(50),
  "sibling_in_school" boolean DEFAULT false,
  "sibling_admission_no" varchar(30),
  "special_needs" text,
  "notes" text,
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "follow_up_date" date,
  "last_contacted_at" timestamp with time zone,
  "converted_to_application_id" uuid,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_enquiry_source" CHECK ("source" IN (
    'walk_in', 'phone', 'website', 'social_media', 'referral',
    'newspaper_ad', 'hoarding', 'school_event', 'alumni', 'google', 'whatsapp', 'other'
  )),
  CONSTRAINT "chk_enquiry_status" CHECK ("status" IN (
    'new', 'contacted', 'campus_visit_scheduled', 'campus_visited',
    'application_issued', 'application_submitted', 'test_scheduled',
    'offer_made', 'fee_paid', 'enrolled', 'lost', 'dropped'
  ))
);

ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_enquiries_status" ON "enquiries" ("tenant_id", "status", "follow_up_date") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_enquiries_search" ON "enquiries" USING gin (to_tsvector('simple', coalesce(student_name, '') || ' ' || coalesce(parent_name, '')));

-- ── 2. admission_applications ─────────────────────────────
CREATE TABLE IF NOT EXISTS "admission_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enquiry_id" uuid,
  "academic_year_id" uuid NOT NULL,
  "standard_id" uuid NOT NULL,
  "section_id" uuid,
  "form_data" jsonb NOT NULL DEFAULT '{}',
  "status" varchar(20) NOT NULL DEFAULT 'submitted',
  "is_rte_application" boolean NOT NULL DEFAULT false,
  "rte_lottery_rank" integer,
  "test_score" numeric(5, 2),
  "interview_score" numeric(5, 2),
  "merit_rank" integer,
  "offered_at" timestamp with time zone,
  "offer_expires_at" timestamp with time zone,
  "offer_accepted_at" timestamp with time zone,
  "student_profile_id" uuid,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "chk_application_status" CHECK ("status" IN (
    'draft', 'submitted', 'documents_pending', 'documents_verified',
    'test_scheduled', 'test_completed', 'interview_scheduled', 'interview_completed',
    'merit_listed', 'offer_made', 'offer_accepted', 'fee_pending',
    'fee_paid', 'enrolled', 'waitlisted', 'rejected', 'withdrawn', 'expired'
  ))
);

ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_standard_id_fk" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_applications_status" ON "admission_applications" ("tenant_id", "status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_applications_academic_year" ON "admission_applications" ("tenant_id", "academic_year_id") WHERE "deleted_at" IS NULL;

-- ── 3. application_documents ──────────────────────────────
CREATE TABLE IF NOT EXISTS "application_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "type" varchar(50) NOT NULL,
  "file_urls" text[] NOT NULL,
  "is_verified" boolean DEFAULT false,
  "verified_by" uuid,
  "verified_at" timestamp with time zone,
  "rejection_reason" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_verified_by_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_application_documents_app" ON "application_documents" ("application_id");

-- ── 4. ENABLE + FORCE ROW LEVEL SECURITY ──────────────────
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enquiries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "admission_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_applications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "application_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_documents" FORCE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — enquiries (tenantPolicies) ─────────
CREATE POLICY "enquiries_app_select" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "enquiries_app_select_trash" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "enquiries_app_insert" ON "enquiries" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "enquiries_app_update" ON "enquiries" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "enquiries_app_delete" ON "enquiries" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "enquiries_reseller_read" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "enquiries_admin_all" ON "enquiries" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 6. RLS Policies — admission_applications (tenantPolicies) ──
CREATE POLICY "admission_applications_app_select" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "admission_applications_app_select_trash" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "admission_applications_app_insert" ON "admission_applications" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "admission_applications_app_update" ON "admission_applications" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "admission_applications_app_delete" ON "admission_applications" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "admission_applications_reseller_read" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "admission_applications_admin_all" ON "admission_applications" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 7. RLS Policies — application_documents (tenantPoliciesSimple) ──
CREATE POLICY "application_documents_app_select" ON "application_documents" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "application_documents_app_insert" ON "application_documents" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "application_documents_app_update" ON "application_documents" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "application_documents_app_delete" ON "application_documents" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "application_documents_reseller_read" ON "application_documents" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "application_documents_admin_all" ON "application_documents" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 8. GRANTs ─────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON enquiries TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON admission_applications TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON application_documents TO roviq_app;

GRANT SELECT ON enquiries TO roviq_reseller;
GRANT SELECT ON admission_applications TO roviq_reseller;
GRANT SELECT ON application_documents TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON enquiries TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_applications TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON application_documents TO roviq_admin;
