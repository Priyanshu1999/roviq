CREATE TYPE "AcademicYearStatus" AS ENUM('PLANNING', 'ACTIVE', 'COMPLETING', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "resellerTier" AS ENUM('full_management', 'support_management', 'read_only');--> statement-breakpoint
ALTER TYPE "InstituteStatus" ADD VALUE 'PENDING_APPROVAL' BEFORE 'PENDING';--> statement-breakpoint
CREATE TABLE "tenant_sequences" (
	"tenant_id" uuid,
	"sequence_name" varchar(80),
	"current_value" bigint DEFAULT 0 NOT NULL,
	"prefix" varchar(20),
	"format_template" varchar(50),
	CONSTRAINT "tenant_sequences_pkey" PRIMARY KEY("tenant_id","sequence_name")
);
--> statement-breakpoint
ALTER TABLE "tenant_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"line1" varchar(255) NOT NULL,
	"line2" varchar(255),
	"line3" varchar(255),
	"city" varchar(100) NOT NULL,
	"district" varchar(100),
	"state" varchar(100) NOT NULL,
	"country" varchar(50) DEFAULT 'India' NOT NULL,
	"postal_code" varchar(10) NOT NULL,
	"coordinates" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_address_type" CHECK ("type" IN ('permanent', 'current', 'emergency'))
);
--> statement-breakpoint
CREATE TABLE "user_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" varchar(255),
	"file_urls" text[] NOT NULL,
	"reference_number" varchar(100),
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"rejection_reason" varchar(255),
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_document_type" CHECK ("type" IN (
        'birth_certificate', 'tc_incoming', 'report_card', 'aadhaar_card',
        'caste_certificate', 'income_certificate', 'ews_certificate',
        'medical_certificate', 'disability_certificate', 'address_proof',
        'passport_photo', 'family_photo', 'bpl_card', 'transfer_order',
        'noc', 'affidavit', 'other'
      ))
);
--> statement-breakpoint
CREATE TABLE "user_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"value_encrypted" bytea,
	"value_hash" varchar(64),
	"value_plain" varchar(50),
	"value_masked" varchar(20),
	"issuing_authority" varchar(100),
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_identifier_value" CHECK ((
        "value_encrypted" IS NOT NULL
        AND "value_hash" IS NOT NULL
        AND "value_masked" IS NOT NULL
      ) OR "value_plain" IS NOT NULL),
	CONSTRAINT "chk_identifier_type" CHECK ("type" IN (
        'aadhaar', 'pan', 'passport', 'voter_id',
        'apaar', 'pen', 'cbse_registration', 'bseh_enrollment',
        'shala_darpan_id', 'parivar_pehchan_patra', 'jan_aadhaar',
        'migration_certificate'
      ))
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"name_local" varchar(200),
	"gender" varchar(10),
	"date_of_birth" date,
	"blood_group" varchar(5),
	"nationality" varchar(50) DEFAULT 'Indian',
	"religion" varchar(30),
	"mother_tongue" varchar(50),
	"profile_image_url" text,
	"cover_image_url" text,
	"search_vector" tsvector,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_gender" CHECK ("gender" IN ('male', 'female', 'other')),
	CONSTRAINT "chk_blood_group" CHECK ("blood_group" IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'))
);
--> statement-breakpoint
DROP POLICY "institute_groups_app_select_trash" ON "institute_groups";--> statement-breakpoint
DROP POLICY "invoices_app_select" ON "invoices";--> statement-breakpoint
DROP POLICY "invoices_app_select_trash" ON "invoices";--> statement-breakpoint
DROP POLICY "invoices_app_insert" ON "invoices";--> statement-breakpoint
DROP POLICY "invoices_app_update" ON "invoices";--> statement-breakpoint
DROP POLICY "invoices_app_delete" ON "invoices";--> statement-breakpoint
DROP POLICY "invoices_admin_all" ON "invoices";--> statement-breakpoint
DROP POLICY "payment_events_app_select" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_events_app_insert" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_events_app_update" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_events_app_delete" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_events_reseller_read" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_events_admin_all" ON "payment_events";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_app_select" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_app_select_trash" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_app_insert" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_app_update" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_app_delete" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "payment_gateway_configs_admin_all" ON "payment_gateway_configs";--> statement-breakpoint
DROP POLICY "subscriptions_app_select" ON "subscriptions";--> statement-breakpoint
DROP POLICY "subscriptions_app_select_trash" ON "subscriptions";--> statement-breakpoint
DROP POLICY "subscriptions_app_insert" ON "subscriptions";--> statement-breakpoint
DROP POLICY "subscriptions_app_update" ON "subscriptions";--> statement-breakpoint
DROP POLICY "subscriptions_app_delete" ON "subscriptions";--> statement-breakpoint
DROP POLICY "subscriptions_admin_all" ON "subscriptions";--> statement-breakpoint
DROP POLICY "institutes_app_insert" ON "institutes";--> statement-breakpoint
DROP POLICY "institutes_app_update" ON "institutes";--> statement-breakpoint
DROP POLICY "institutes_app_delete" ON "institutes";--> statement-breakpoint
DROP POLICY "profiles_app_select" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_app_select_trash" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_app_insert" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_app_update" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_app_delete" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_reseller_read" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_admin_all" ON "profiles";--> statement-breakpoint
DROP POLICY "student_guardians_app_select" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_app_select_trash" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_app_insert" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_app_update" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_app_delete" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_reseller_read" ON "student_guardians";--> statement-breakpoint
DROP POLICY "student_guardians_admin_all" ON "student_guardians";--> statement-breakpoint
ALTER TABLE "institute_groups" DROP CONSTRAINT "institute_groups_created_by_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_subscriptions_id_fkey";--> statement-breakpoint
ALTER TABLE "payment_events" DROP CONSTRAINT "payment_events_subscription_id_subscriptions_id_fkey";--> statement-breakpoint
ALTER TABLE "payment_events" DROP CONSTRAINT "payment_events_invoice_id_invoices_id_fkey";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fkey";--> statement-breakpoint
ALTER TABLE "student_guardians" DROP CONSTRAINT "student_guardians_student_profile_id_profiles_id_fkey";--> statement-breakpoint
ALTER TABLE "student_guardians" DROP CONSTRAINT "student_guardians_guardian_profile_id_profiles_id_fkey";--> statement-breakpoint
DROP TABLE "invoices";--> statement-breakpoint
DROP TABLE "payment_events";--> statement-breakpoint
DROP TABLE "payment_gateway_configs";--> statement-breakpoint
DROP TABLE "subscription_plans";--> statement-breakpoint
DROP TABLE "subscriptions";--> statement-breakpoint
DROP TABLE "profiles";--> statement-breakpoint
DROP TABLE "student_guardians";--> statement-breakpoint
DROP INDEX "memberships_user_id_tenant_id_key";--> statement-breakpoint
ALTER TABLE "institute_branding" ADD COLUMN "theme_identifier" text;--> statement-breakpoint
ALTER TABLE "institute_configs" ADD COLUMN "section_strength_norms" jsonb DEFAULT '{"optimal":40,"hardMax":45,"exemptionAllowed":true}';--> statement-breakpoint
ALTER TABLE "institute_configs" ADD COLUMN "admission_number_config" jsonb DEFAULT '{"format":"{prefix}{year}/{value:04d}","year_format":"YYYY","prefixes":{"1":"A-","-3":"N-","-2":"L-","-1":"U-"},"no_prefix_from_class":2}';--> statement-breakpoint
ALTER TABLE "institute_groups" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "departments" "EducationLevel"[] DEFAULT '{}'::"EducationLevel"[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "medium_of_instruction" text;--> statement-breakpoint
ALTER TABLE "institute_branding" DROP COLUMN "theme";--> statement-breakpoint
ALTER TABLE "institute_groups" DROP COLUMN "registration_no";--> statement-breakpoint
ALTER TABLE "institute_groups" DROP COLUMN "created_by_id";--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN "medium";--> statement-breakpoint
ALTER TABLE "academic_years" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "academic_years" ALTER COLUMN "status" SET DATA TYPE "AcademicYearStatus" USING "status"::"AcademicYearStatus";--> statement-breakpoint
ALTER TABLE "academic_years" ALTER COLUMN "status" SET DEFAULT 'PLANNING'::"AcademicYearStatus";--> statement-breakpoint
ALTER TABLE "institute_affiliations" ALTER COLUMN "valid_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "institute_affiliations" ALTER COLUMN "valid_to" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "institutes" ALTER COLUMN "code" SET DATA TYPE varchar(50) USING "code"::varchar(50);--> statement-breakpoint
ALTER TABLE "sections" ALTER COLUMN "stream" SET DATA TYPE jsonb USING "stream"::jsonb;--> statement-breakpoint
ALTER TABLE "resellers" ALTER COLUMN "tier" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "resellers" ALTER COLUMN "tier" SET DATA TYPE "resellerTier" USING "tier"::text::"resellerTier";--> statement-breakpoint
ALTER TABLE "resellers" ALTER COLUMN "tier" SET DEFAULT 'full_management'::"resellerTier";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_phone_numbers_primary" ON "phone_numbers" ("user_id") WHERE "is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_role_id_key" ON "memberships" ("user_id","tenant_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_address_user_type" ON "user_addresses" ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_user_addresses_user_id" ON "user_addresses" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_documents_user_type" ON "user_documents" ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_identifier_user_type" ON "user_identifiers" ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_identifiers_aadhaar_hash" ON "user_identifiers" ("value_hash") WHERE type = 'aadhaar';--> statement-breakpoint
CREATE INDEX "idx_user_identifiers_user_id" ON "user_identifiers" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_user_id" ON "user_profiles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_search" ON "user_profiles" USING gin (search_vector);--> statement-breakpoint
ALTER TABLE "tenant_sequences" ADD CONSTRAINT "tenant_sequences_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_groups" ADD CONSTRAINT "institute_groups_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_group_id_institute_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "institute_groups"("id");--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_verified_by_users_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_verified_by_users_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");--> statement-breakpoint
CREATE POLICY "tenant_sequences_app_select" ON "tenant_sequences" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_sequences_app_insert" ON "tenant_sequences" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_sequences_app_update" ON "tenant_sequences" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_sequences_app_delete" ON "tenant_sequences" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "tenant_sequences_reseller_read" ON "tenant_sequences" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "tenant_sequences_admin_all" ON "tenant_sequences" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_groups_reseller_read" ON "institute_groups" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (id IN (
        SELECT group_id FROM institutes
        WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
          AND group_id IS NOT NULL
      ));--> statement-breakpoint
ALTER POLICY "institute_groups_app_select" ON "institute_groups" TO "roviq_app" USING (id = (
        SELECT group_id FROM institutes
        WHERE id = current_setting('app.current_tenant_id', true)::uuid
      ));--> statement-breakpoint
ALTER POLICY "institute_groups_app_insert" ON "institute_groups" TO "roviq_app" WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "institute_groups_app_update" ON "institute_groups" TO "roviq_app" USING (false);--> statement-breakpoint
ALTER POLICY "institutes_app_select" ON "institutes" TO "roviq_app" USING (id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);--> statement-breakpoint
ALTER POLICY "institutes_app_select_trash" ON "institutes" TO "roviq_app" USING (
        id = current_setting('app.current_tenant_id', true)::uuid
        AND deleted_at IS NOT NULL
        AND current_setting('app.include_deleted', true) = 'true'
      );--> statement-breakpoint
DROP TYPE "BillingInterval";--> statement-breakpoint
DROP TYPE "GatewayConfigStatus";--> statement-breakpoint
DROP TYPE "InvoiceStatus";--> statement-breakpoint
DROP TYPE "PaymentProvider";--> statement-breakpoint
DROP TYPE "PlanStatus";--> statement-breakpoint
DROP TYPE "SubscriptionStatus";--> statement-breakpoint
DROP TYPE "reseller_tier";