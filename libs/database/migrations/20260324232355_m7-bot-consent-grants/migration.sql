-- M7: Bot profiles, consent records, privacy notices — CREATE, RLS, FORCE, GRANTs

-- ── 1. bot_profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bot_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "bot_type" varchar(30) NOT NULL,
  "api_key_hash" text,
  "api_key_prefix" varchar(12),
  "api_key_expires_at" timestamp with time zone,
  "last_active_at" timestamp with time zone,
  "rate_limit_tier" varchar(10) DEFAULT 'low',
  "config" jsonb DEFAULT '{}'::jsonb,
  "webhook_url" text,
  "is_system_bot" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "bot_profiles_membership_id_unique" UNIQUE ("membership_id"),
  CONSTRAINT "chk_bot_type" CHECK ("bot_type" IN (
    'system_notification', 'fee_reminder', 'attendance_notification',
    'homework_reminder', 'ai_chatbot_parent', 'ai_chatbot_student',
    'integration', 'report_generation', 'bulk_operation', 'admission_chatbot'
  )),
  CONSTRAINT "chk_rate_limit_tier" CHECK ("rate_limit_tier" IS NULL OR "rate_limit_tier" IN ('low', 'medium', 'high')),
  CONSTRAINT "chk_bot_status" CHECK ("status" IN ('active', 'suspended', 'deactivated'))
);

ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

-- ── 2. consent_records ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "guardian_profile_id" uuid NOT NULL,
  "student_profile_id" uuid NOT NULL,
  "purpose" varchar(50) NOT NULL,
  "is_granted" boolean NOT NULL,
  "granted_at" timestamp with time zone,
  "withdrawn_at" timestamp with time zone,
  "verification_method" varchar(30),
  "verification_reference" varchar(100),
  "ip_address" inet,
  "user_agent" text,
  "privacy_notice_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_consent_purpose" CHECK ("purpose" IN (
    'academic_data_processing', 'photo_video_marketing', 'whatsapp_communication',
    'sms_communication', 'aadhaar_collection', 'biometric_collection',
    'third_party_edtech', 'board_exam_registration', 'transport_tracking',
    'health_data_processing', 'cctv_monitoring'
  )),
  CONSTRAINT "chk_verification_method" CHECK ("verification_method" IS NULL OR "verification_method" IN (
    'digilocker_token', 'aadhaar_otp', 'in_person_id_check',
    'signed_form_uploaded', 'school_erp_verified_account'
  ))
);

ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_guardian_profile_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "guardian_profiles"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_student_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE INDEX IF NOT EXISTS "idx_consent_guardian" ON "consent_records" ("guardian_profile_id", "purpose");
CREATE INDEX IF NOT EXISTS "idx_consent_student" ON "consent_records" ("student_profile_id", "purpose");

-- ── 3. privacy_notices ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "privacy_notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "language" varchar(10) NOT NULL DEFAULT 'en',
  "content" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "privacy_notices" ADD CONSTRAINT "privacy_notices_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_notice_version" ON "privacy_notices" ("tenant_id", "version", "language");

-- ── 4. ENABLE + FORCE ROW LEVEL SECURITY ────────────────────
ALTER TABLE "bot_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bot_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;
ALTER TABLE "privacy_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "privacy_notices" FORCE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — bot_profiles (tenantPolicies: 7 policies with deleted_at) ──
CREATE POLICY "bot_profiles_app_select" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "bot_profiles_app_select_trash" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "bot_profiles_app_insert" ON "bot_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "bot_profiles_app_update" ON "bot_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "bot_profiles_app_delete" ON "bot_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "bot_profiles_reseller_read" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "bot_profiles_admin_all" ON "bot_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 6. RLS Policies — consent_records (CUSTOM APPEND-ONLY: no UPDATE, no DELETE for roviq_app) ──
CREATE POLICY "consent_records_app_select" ON "consent_records" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "consent_records_app_insert" ON "consent_records" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "consent_records_app_update" ON "consent_records" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (false);
CREATE POLICY "consent_records_app_delete" ON "consent_records" AS PERMISSIVE FOR DELETE TO "roviq_app"
  USING (false);
CREATE POLICY "consent_records_reseller_read" ON "consent_records" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "consent_records_admin_all" ON "consent_records" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 7. RLS Policies — privacy_notices (tenantPoliciesSimple: 6 policies, no deleted_at) ──
CREATE POLICY "privacy_notices_app_select" ON "privacy_notices" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "privacy_notices_app_insert" ON "privacy_notices" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "privacy_notices_app_update" ON "privacy_notices" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "privacy_notices_app_delete" ON "privacy_notices" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "privacy_notices_reseller_read" ON "privacy_notices" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "privacy_notices_admin_all" ON "privacy_notices" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 8. GRANTs ───────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON bot_profiles TO roviq_app;
GRANT SELECT, INSERT ON consent_records TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON privacy_notices TO roviq_app;

GRANT SELECT ON bot_profiles TO roviq_reseller;
GRANT SELECT ON consent_records TO roviq_reseller;
GRANT SELECT ON privacy_notices TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_profiles TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent_records TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON privacy_notices TO roviq_admin;
