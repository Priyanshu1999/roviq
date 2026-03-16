CREATE TYPE "BillingInterval" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "InvoiceStatus" AS ENUM('PAID', 'PENDING', 'OVERDUE', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "PaymentProvider" AS ENUM('CASHFREE', 'RAZORPAY');--> statement-breakpoint
CREATE TYPE "SubscriptionStatus" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'PENDING_PAYMENT', 'PAUSED', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"impersonator_id" uuid,
	"action" varchar(100) NOT NULL,
	"action_type" varchar(20) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"changes" jsonb,
	"metadata" jsonb,
	"correlation_id" uuid NOT NULL,
	"ip_address" inet,
	"user_agent" text,
	"source" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "audit_logs_pkey" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_providers" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text,
	"provider_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"number" text NOT NULL,
	"label" text DEFAULT 'personal' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_whatsapp" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"token_hash" text NOT NULL,
	"device_info" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY,
	"subscription_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "InvoiceStatus" DEFAULT 'PENDING'::"InvoiceStatus" NOT NULL,
	"provider_invoice_id" text,
	"provider_payment_id" text,
	"billing_period_start" timestamp with time zone NOT NULL,
	"billing_period_end" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"due_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"provider" "PaymentProvider" NOT NULL,
	"event_type" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" "BillingInterval" NOT NULL,
	"feature_limits" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'PENDING_PAYMENT'::"SubscriptionStatus" NOT NULL,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_notification_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"notification_type" text NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"digest_enabled" boolean DEFAULT false NOT NULL,
	"digest_cron" text,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institute_notification_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"abilities" jsonb DEFAULT '[]',
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY,
	"name" jsonb NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"membership_id" uuid NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" jsonb NOT NULL,
	"abilities" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY,
	"student_profile_id" uuid NOT NULL,
	"guardian_profile_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_action_type_created_at_idx" ON "audit_logs" ("tenant_id","action_type","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_created_at_idx" ON "audit_logs" ("tenant_id","entity_type","entity_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_user_id_created_at_idx" ON "audit_logs" ("tenant_id","user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs" ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_impersonator_id_idx" ON "audit_logs" ("tenant_id","impersonator_id") WHERE (impersonator_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "auth_providers_provider_provider_user_id_key" ON "auth_providers" ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_providers_user_id_idx" ON "auth_providers" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_numbers_country_code_number_key" ON "phone_numbers" ("country_code","number");--> statement-breakpoint
CREATE INDEX "phone_numbers_user_id_idx" ON "phone_numbers" ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_tenant_id_idx" ON "refresh_tokens" ("tenant_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");--> statement-breakpoint
CREATE INDEX "invoices_organization_id_idx" ON "invoices" ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events" ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_subscription_id_idx" ON "payment_events" ("subscription_id");--> statement-breakpoint
CREATE INDEX "payment_events_invoice_id_idx" ON "payment_events" ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_configs_organization_id_key" ON "payment_gateway_configs" ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_notification_configs_tenant_id_notification_type_key" ON "institute_notification_configs" ("tenant_id","notification_type");--> statement-breakpoint
CREATE INDEX "institute_notification_configs_tenant_id_idx" ON "institute_notification_configs" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships" ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_id_idx" ON "memberships" ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_id_role_id_idx" ON "memberships" ("tenant_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_membership_id_type_key" ON "profiles" ("membership_id","type");--> statement-breakpoint
CREATE INDEX "profiles_tenant_id_idx" ON "profiles" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles" ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "roles_tenant_id_idx" ON "roles" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_student_profile_id_guardian_profile_id_key" ON "student_guardians" ("student_profile_id","guardian_profile_id");--> statement-breakpoint
CREATE INDEX "student_guardians_tenant_id_idx" ON "student_guardians" ("tenant_id");--> statement-breakpoint
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_notification_configs" ADD CONSTRAINT "institute_notification_configs_tenant_id_organizations_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_organizations_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_organizations_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_profile_id_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_profile_id_profiles_id_fkey" FOREIGN KEY ("guardian_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "admin_platform_access_audit_logs" ON "audit_logs" AS PERMISSIVE FOR SELECT TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "audit_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation_audit_logs" ON "audit_logs" AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_refresh_tokens" ON "refresh_tokens" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_refresh_tokens" ON "refresh_tokens" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_invoices" ON "invoices" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_invoices" ON "invoices" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_payment_events" ON "payment_events" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_payment_events" ON "payment_events" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_payment_gateway_configs" ON "payment_gateway_configs" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_payment_gateway_configs" ON "payment_gateway_configs" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_subscriptions" ON "subscriptions" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_subscriptions" ON "subscriptions" AS PERMISSIVE FOR ALL TO public USING ((organization_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_institute_notification_configs" ON "institute_notification_configs" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_institute_notification_configs" ON "institute_notification_configs" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_memberships" ON "memberships" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_memberships" ON "memberships" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_profiles" ON "profiles" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_profiles" ON "profiles" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_roles" ON "roles" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_roles" ON "roles" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "admin_platform_access_student_guardians" ON "student_guardians" AS PERMISSIVE FOR ALL TO public USING ((current_setting('app.is_platform_admin'::text, true) = 'true'::text));--> statement-breakpoint
CREATE POLICY "tenant_isolation_student_guardians" ON "student_guardians" AS PERMISSIVE FOR ALL TO public USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));