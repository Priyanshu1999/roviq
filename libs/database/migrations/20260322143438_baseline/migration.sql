CREATE TYPE "AffiliationStatus" AS ENUM('PROVISIONAL', 'REGULAR', 'EXTENSION_PENDING', 'REVOKED');--> statement-breakpoint
CREATE TYPE "AttendanceType" AS ENUM('LECTURE_WISE', 'DAILY');--> statement-breakpoint
CREATE TYPE "BatchStatus" AS ENUM('UPCOMING', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "BillingInterval" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "BoardType" AS ENUM('CBSE', 'BSEH', 'RBSE', 'ICSE');--> statement-breakpoint
CREATE TYPE "EducationLevel" AS ENUM('PRE_PRIMARY', 'PRIMARY', 'UPPER_PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY');--> statement-breakpoint
CREATE TYPE "GatewayConfigStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "GenderRestriction" AS ENUM('CO_ED', 'BOYS_ONLY', 'GIRLS_ONLY');--> statement-breakpoint
CREATE TYPE "GroupStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "GroupType" AS ENUM('TRUST', 'SOCIETY', 'CHAIN', 'FRANCHISE');--> statement-breakpoint
CREATE TYPE "IdentifierType" AS ENUM('UDISE_PLUS', 'CBSE_AFFILIATION', 'CBSE_SCHOOL_CODE', 'BSEH_AFFILIATION', 'RBSE_REGISTRATION', 'SOCIETY_REGISTRATION', 'STATE_RECOGNITION', 'SHALA_DARPAN_ID');--> statement-breakpoint
CREATE TYPE "InstituteStatus" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "InstituteType" AS ENUM('SCHOOL', 'COACHING', 'LIBRARY');--> statement-breakpoint
CREATE TYPE "InvoiceStatus" AS ENUM('PAID', 'PENDING', 'OVERDUE', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "MembershipStatus" AS ENUM('ACTIVE', 'SUSPENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "NepStage" AS ENUM('FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY');--> statement-breakpoint
CREATE TYPE "PaymentProvider" AS ENUM('CASHFREE', 'RAZORPAY');--> statement-breakpoint
CREATE TYPE "PlanStatus" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "ResellerStatus" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "reseller_tier" AS ENUM('full_management', 'support_management', 'read_only');--> statement-breakpoint
CREATE TYPE "RoleStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "SetupStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "StreamType" AS ENUM('SCIENCE', 'COMMERCE', 'ARTS');--> statement-breakpoint
CREATE TYPE "StructureFramework" AS ENUM('NEP', 'TRADITIONAL');--> statement-breakpoint
CREATE TYPE "SubjectType" AS ENUM('ACADEMIC', 'LANGUAGE', 'SKILL', 'EXTRACURRICULAR', 'INTERNAL_ASSESSMENT');--> statement-breakpoint
CREATE TYPE "SubscriptionStatus" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'PENDING_PAYMENT', 'PAUSED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "UserStatus" AS ENUM('ACTIVE', 'SUSPENDED', 'LOCKED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid DEFAULT gen_random_uuid(),
	"scope" varchar(20) NOT NULL,
	"tenant_id" uuid,
	"reseller_id" uuid,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"impersonator_id" uuid,
	"impersonation_session_id" uuid,
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
	CONSTRAINT "audit_logs_pkey" PRIMARY KEY("id","created_at"),
	CONSTRAINT "chk_audit_scope" CHECK (CASE "scope"
        WHEN 'institute' THEN "tenant_id" IS NOT NULL
        WHEN 'reseller'  THEN "reseller_id" IS NOT NULL AND "tenant_id" IS NULL
        WHEN 'platform'  THEN "tenant_id" IS NULL AND "reseller_id" IS NULL
      END)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"scope" varchar(20),
	"tenant_id" uuid,
	"reseller_id" uuid,
	"auth_method" varchar(30),
	"ip_address" inet,
	"user_agent" text,
	"device_info" text,
	"failure_reason" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text,
	"provider_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"impersonator_id" uuid NOT NULL,
	"impersonator_scope" varchar(20) NOT NULL,
	"target_user_id" uuid NOT NULL,
	"target_tenant_id" uuid,
	"reason" text NOT NULL,
	"ip_address" inet,
	"user_agent" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" varchar(50),
	"otp_verified" timestamp with time zone,
	"otp_verified_by" uuid,
	CONSTRAINT "chk_reason_length" CHECK (length("reason") >= 10),
	CONSTRAINT "chk_max_duration" CHECK ("expires_at" <= "started_at" + interval '1 hour')
);
--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE "platform_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"abilities" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid,
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"membership_scope" varchar(20) NOT NULL,
	"token_hash" text NOT NULL,
	"device_info" text,
	"ip_address" inet,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"status" "UserStatus" DEFAULT 'ACTIVE'::"UserStatus" NOT NULL,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subscription_id" uuid NOT NULL,
	"institute_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"institute_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"institute_id" uuid NOT NULL,
	"provider" "PaymentProvider" NOT NULL,
	"status" "GatewayConfigStatus" DEFAULT 'ACTIVE'::"GatewayConfigStatus" NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" jsonb NOT NULL,
	"description" jsonb,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" "BillingInterval" NOT NULL,
	"feature_limits" jsonb NOT NULL,
	"status" "PlanStatus" DEFAULT 'ACTIVE'::"PlanStatus" NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"institute_id" uuid NOT NULL,
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
CREATE TABLE "reseller_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"reseller_id" uuid NOT NULL,
	"abilities" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reseller_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"tier" "reseller_tier" DEFAULT 'full_management'::"reseller_tier" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "ResellerStatus" DEFAULT 'active'::"ResellerStatus" NOT NULL,
	"suspended_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"branding" jsonb DEFAULT '{}',
	"custom_domain" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resellers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'PLANNING' NOT NULL,
	"term_structure" jsonb DEFAULT '[]',
	"board_exam_dates" jsonb DEFAULT '{}',
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "academic_years_date_check" CHECK ("start_date" < "end_date")
);
--> statement-breakpoint
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institute_affiliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"board" "BoardType" NOT NULL,
	"affiliation_status" "AffiliationStatus" DEFAULT 'PROVISIONAL'::"AffiliationStatus" NOT NULL,
	"affiliation_number" text,
	"granted_level" text,
	"valid_from" date,
	"valid_to" date,
	"noc_number" text,
	"noc_date" date,
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
ALTER TABLE "institute_affiliations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text,
	"secondary_color" text,
	"theme" text,
	"cover_image_url" text,
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
ALTER TABLE "institute_branding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"attendance_type" "AttendanceType" DEFAULT 'DAILY'::"AttendanceType" NOT NULL,
	"opening_time" time,
	"closing_time" time,
	"shifts" jsonb DEFAULT '[]',
	"notification_preferences" jsonb DEFAULT '{}',
	"payroll_config" jsonb DEFAULT '{}',
	"grading_system" jsonb DEFAULT '{}',
	"term_structure" jsonb DEFAULT '[]',
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
ALTER TABLE "institute_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_group_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text,
	"secondary_color" text,
	"theme" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institute_group_branding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" "GroupType" NOT NULL,
	"registration_no" text,
	"registration_state" text,
	"contact" jsonb DEFAULT '{"phones":[],"emails":[]}' NOT NULL,
	"address" jsonb,
	"status" "GroupStatus" DEFAULT 'ACTIVE'::"GroupStatus" NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institute_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institute_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "IdentifierType" NOT NULL,
	"value" text NOT NULL,
	"issuing_authority" text,
	"valid_from" date,
	"valid_to" date,
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
ALTER TABLE "institute_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "institutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" jsonb NOT NULL,
	"slug" text NOT NULL,
	"code" text,
	"type" "InstituteType" DEFAULT 'SCHOOL'::"InstituteType" NOT NULL,
	"structure_framework" "StructureFramework" DEFAULT 'TRADITIONAL'::"StructureFramework" NOT NULL,
	"setup_status" "SetupStatus" DEFAULT 'PENDING'::"SetupStatus" NOT NULL,
	"contact" jsonb DEFAULT '{"phones":[],"emails":[]}' NOT NULL,
	"address" jsonb,
	"logo_url" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"status" "InstituteStatus" DEFAULT 'ACTIVE'::"InstituteStatus" NOT NULL,
	"reseller_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL,
	"group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institutes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"abilities" jsonb DEFAULT '[]',
	"status" "MembershipStatus" DEFAULT 'ACTIVE'::"MembershipStatus" NOT NULL,
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
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid,
	"scope" varchar(20) DEFAULT 'institute' NOT NULL,
	"reseller_id" uuid,
	"name" jsonb NOT NULL,
	"abilities" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"status" "RoleStatus" DEFAULT 'ACTIVE'::"RoleStatus" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_role_scope" CHECK (CASE "scope"
        WHEN 'platform'  THEN "tenant_id" IS NULL AND "reseller_id" IS NULL
        WHEN 'reseller'  THEN "tenant_id" IS NULL AND "reseller_id" IS NOT NULL
        WHEN 'institute' THEN "tenant_id" IS NOT NULL AND "reseller_id" IS NULL
      END)
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "section_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
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
ALTER TABLE "section_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"standard_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_label" text,
	"stream" "StreamType",
	"medium" text,
	"shift" text,
	"class_teacher_id" uuid,
	"room" text,
	"capacity" integer DEFAULT 40,
	"current_strength" integer DEFAULT 0 NOT NULL,
	"gender_restriction" "GenderRestriction" DEFAULT 'CO_ED'::"GenderRestriction" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"start_time" time,
	"end_time" time,
	"batch_status" "BatchStatus",
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
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "standard_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_id" uuid NOT NULL,
	"standard_id" uuid NOT NULL,
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
ALTER TABLE "standard_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"numeric_order" integer NOT NULL,
	"level" "EducationLevel",
	"nep_stage" "NepStage",
	"department" text,
	"is_board_exam_class" boolean DEFAULT false NOT NULL,
	"stream_applicable" boolean DEFAULT false NOT NULL,
	"max_sections_allowed" integer,
	"max_students_per_section" integer DEFAULT 40,
	"udise_class_code" integer,
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
ALTER TABLE "standards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"short_name" text,
	"board_code" text,
	"type" "SubjectType" DEFAULT 'ACADEMIC'::"SubjectType" NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"has_practical" boolean DEFAULT false NOT NULL,
	"theory_marks" integer,
	"practical_marks" integer,
	"internal_marks" integer,
	"is_elective" boolean DEFAULT false NOT NULL,
	"elective_group" text,
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
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "auth_events_user_id_idx" ON "auth_events" ("user_id");--> statement-breakpoint
CREATE INDEX "auth_events_event_type_idx" ON "auth_events" ("event_type");--> statement-breakpoint
CREATE INDEX "auth_events_tenant_id_idx" ON "auth_events" ("tenant_id");--> statement-breakpoint
CREATE INDEX "auth_events_created_at_idx" ON "auth_events" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_providers_provider_provider_user_id_key" ON "auth_providers" ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_providers_user_id_idx" ON "auth_providers" ("user_id");--> statement-breakpoint
CREATE INDEX "impersonation_sessions_impersonator_idx" ON "impersonation_sessions" ("impersonator_id");--> statement-breakpoint
CREATE INDEX "impersonation_sessions_target_user_idx" ON "impersonation_sessions" ("target_user_id");--> statement-breakpoint
CREATE INDEX "impersonation_sessions_target_tenant_idx" ON "impersonation_sessions" ("target_tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_numbers_country_code_number_key" ON "phone_numbers" ("country_code","number");--> statement-breakpoint
CREATE INDEX "phone_numbers_user_id_idx" ON "phone_numbers" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_membership_user" ON "platform_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_tenant_id_idx" ON "refresh_tokens" ("tenant_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");--> statement-breakpoint
CREATE INDEX "invoices_institute_id_idx" ON "invoices" ("institute_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events" ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_subscription_id_idx" ON "payment_events" ("subscription_id");--> statement-breakpoint
CREATE INDEX "payment_events_invoice_id_idx" ON "payment_events" ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_configs_institute_id_key" ON "payment_gateway_configs" ("institute_id");--> statement-breakpoint
CREATE INDEX "subscriptions_institute_id_idx" ON "subscriptions" ("institute_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_notification_configs_tenant_id_notification_type_key" ON "institute_notification_configs" ("tenant_id","notification_type");--> statement-breakpoint
CREATE INDEX "institute_notification_configs_tenant_id_idx" ON "institute_notification_configs" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reseller_membership" ON "reseller_memberships" ("user_id","reseller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resellers_slug_key" ON "resellers" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_tenant_active_key" ON "academic_years" ("tenant_id") WHERE "is_active" = true AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "academic_years_tenant_id_idx" ON "academic_years" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_user_group_key" ON "group_memberships" ("user_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_affiliations_tenant_board_key" ON "institute_affiliations" ("tenant_id","board") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "institute_affiliations_tenant_id_idx" ON "institute_affiliations" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_branding_tenant_id_key" ON "institute_branding" ("tenant_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "institute_configs_tenant_id_key" ON "institute_configs" ("tenant_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "institute_group_branding_group_id_key" ON "institute_group_branding" ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_groups_code_key" ON "institute_groups" ("code") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "institute_identifiers_tenant_type_key" ON "institute_identifiers" ("tenant_id","type") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "institute_identifiers_tenant_id_idx" ON "institute_identifiers" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutes_slug_key" ON "institutes" ("slug");--> statement-breakpoint
CREATE INDEX "institutes_group_id_idx" ON "institutes" ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutes_code_key" ON "institutes" ("code") WHERE "deleted_at" IS NULL AND "code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "institutes_type_idx" ON "institutes" ("type");--> statement-breakpoint
CREATE INDEX "institutes_reseller_id_idx" ON "institutes" ("reseller_id");--> statement-breakpoint
CREATE INDEX "institutes_status_idx" ON "institutes" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships" ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_id_idx" ON "memberships" ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_id_role_id_idx" ON "memberships" ("tenant_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_membership_id_type_key" ON "profiles" ("membership_id","type");--> statement-breakpoint
CREATE INDEX "profiles_tenant_id_idx" ON "profiles" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles" ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "roles_tenant_id_idx" ON "roles" ("tenant_id");--> statement-breakpoint
CREATE INDEX "roles_scope_idx" ON "roles" ("scope");--> statement-breakpoint
CREATE INDEX "roles_reseller_id_idx" ON "roles" ("reseller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "section_subjects_subject_section_key" ON "section_subjects" ("subject_id","section_id");--> statement-breakpoint
CREATE INDEX "section_subjects_tenant_id_idx" ON "section_subjects" ("tenant_id");--> statement-breakpoint
CREATE INDEX "section_subjects_section_id_idx" ON "section_subjects" ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_standard_name_key" ON "sections" ("standard_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sections_tenant_id_idx" ON "sections" ("tenant_id");--> statement-breakpoint
CREATE INDEX "sections_standard_id_idx" ON "sections" ("standard_id");--> statement-breakpoint
CREATE INDEX "sections_academic_year_id_idx" ON "sections" ("academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standard_subjects_subject_standard_key" ON "standard_subjects" ("subject_id","standard_id");--> statement-breakpoint
CREATE INDEX "standard_subjects_tenant_id_idx" ON "standard_subjects" ("tenant_id");--> statement-breakpoint
CREATE INDEX "standard_subjects_standard_id_idx" ON "standard_subjects" ("standard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standards_tenant_year_name_key" ON "standards" ("tenant_id","academic_year_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "standards_tenant_year_order_key" ON "standards" ("tenant_id","academic_year_id","numeric_order") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "standards_tenant_id_idx" ON "standards" ("tenant_id");--> statement-breakpoint
CREATE INDEX "standards_academic_year_id_idx" ON "standards" ("academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_student_profile_id_guardian_profile_id_key" ON "student_guardians" ("student_profile_id","guardian_profile_id");--> statement-breakpoint
CREATE INDEX "student_guardians_tenant_id_idx" ON "student_guardians" ("tenant_id");--> statement-breakpoint
CREATE INDEX "subjects_tenant_id_idx" ON "subjects" ("tenant_id");--> statement-breakpoint
CREATE INDEX "subjects_type_idx" ON "subjects" ("type");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_id_users_id_fkey" FOREIGN KEY ("impersonator_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_b9nTGtRX9ste_fkey" FOREIGN KEY ("impersonation_session_id") REFERENCES "impersonation_sessions"("id");--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_impersonator_id_users_id_fkey" FOREIGN KEY ("impersonator_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_users_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_tenant_id_institutes_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "institutes"("id");--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_otp_verified_by_users_id_fkey" FOREIGN KEY ("otp_verified_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_institute_id_institutes_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_institute_id_institutes_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_institute_id_institutes_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_notification_configs" ADD CONSTRAINT "institute_notification_configs_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_institute_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "institute_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_affiliations" ADD CONSTRAINT "institute_affiliations_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_branding" ADD CONSTRAINT "institute_branding_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_configs" ADD CONSTRAINT "institute_configs_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_group_branding" ADD CONSTRAINT "institute_group_branding_group_id_institute_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "institute_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_groups" ADD CONSTRAINT "institute_groups_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_identifiers" ADD CONSTRAINT "institute_identifiers_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_subject_id_subjects_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_standard_id_standards_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_memberships_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standard_subjects" ADD CONSTRAINT "standard_subjects_subject_id_subjects_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standard_subjects" ADD CONSTRAINT "standard_subjects_standard_id_standards_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standard_subjects" ADD CONSTRAINT "standard_subjects_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_profile_id_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_profile_id_profiles_id_fkey" FOREIGN KEY ("guardian_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "audit_app_read" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (scope = 'institute' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_app_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "audit_reseller_read" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING ((scope = 'institute' AND tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid)) OR (scope = 'reseller' AND reseller_id = current_setting('app.current_reseller_id', true)::uuid));--> statement-breakpoint
CREATE POLICY "audit_reseller_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO "roviq_reseller" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "audit_admin_all" ON "audit_logs" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "auth_events_app_insert" ON "auth_events" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "auth_events_reseller_insert" ON "auth_events" AS PERMISSIVE FOR INSERT TO "roviq_reseller" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "auth_events_admin_all" ON "auth_events" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "impersonation_sessions_app_select" ON "impersonation_sessions" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (true);--> statement-breakpoint
CREATE POLICY "impersonation_sessions_app_insert" ON "impersonation_sessions" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "impersonation_sessions_reseller_all" ON "impersonation_sessions" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "impersonation_sessions_admin_all" ON "impersonation_sessions" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_membership_admin" ON "platform_memberships" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "refresh_tokens_app_select" ON "refresh_tokens" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "refresh_tokens_app_insert" ON "refresh_tokens" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "refresh_tokens_app_update" ON "refresh_tokens" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "refresh_tokens_app_delete" ON "refresh_tokens" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "refresh_tokens_reseller_read" ON "refresh_tokens" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "refresh_tokens_admin_all" ON "refresh_tokens" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "users_app_select" ON "users" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (true);--> statement-breakpoint
CREATE POLICY "users_reseller_select" ON "users" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (true);--> statement-breakpoint
CREATE POLICY "users_admin_all" ON "users" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "invoices_app_select" ON "invoices" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "invoices_app_select_trash" ON "invoices" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "invoices_app_insert" ON "invoices" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "invoices_app_update" ON "invoices" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "invoices_app_delete" ON "invoices" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "invoices_admin_all" ON "invoices" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_events_app_select" ON "payment_events" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (true);--> statement-breakpoint
CREATE POLICY "payment_events_app_insert" ON "payment_events" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_events_app_update" ON "payment_events" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "payment_events_app_delete" ON "payment_events" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "payment_events_reseller_read" ON "payment_events" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (true);--> statement-breakpoint
CREATE POLICY "payment_events_admin_all" ON "payment_events" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_app_select" ON "payment_gateway_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_app_select_trash" ON "payment_gateway_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_app_insert" ON "payment_gateway_configs" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_app_update" ON "payment_gateway_configs" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_app_delete" ON "payment_gateway_configs" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "payment_gateway_configs_admin_all" ON "payment_gateway_configs" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "subscriptions_app_select" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "subscriptions_app_select_trash" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "subscriptions_app_insert" ON "subscriptions" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "subscriptions_app_update" ON "subscriptions" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "subscriptions_app_delete" ON "subscriptions" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "subscriptions_admin_all" ON "subscriptions" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_notification_configs_app_select" ON "institute_notification_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "institute_notification_configs_app_select_trash" ON "institute_notification_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_notification_configs_app_insert" ON "institute_notification_configs" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_notification_configs_app_update" ON "institute_notification_configs" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_notification_configs_app_delete" ON "institute_notification_configs" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_notification_configs_reseller_read" ON "institute_notification_configs" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_notification_configs_admin_all" ON "institute_notification_configs" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "reseller_membership_own" ON "reseller_memberships" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "reseller_membership_admin" ON "reseller_memberships" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "reseller_own_read" ON "resellers" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "reseller_admin_all" ON "resellers" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "academic_years_app_select" ON "academic_years" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "academic_years_app_select_trash" ON "academic_years" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "academic_years_app_insert" ON "academic_years" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "academic_years_app_update" ON "academic_years" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "academic_years_app_delete" ON "academic_years" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "academic_years_reseller_read" ON "academic_years" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "academic_years_admin_all" ON "academic_years" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_affiliations_app_select" ON "institute_affiliations" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "institute_affiliations_app_select_trash" ON "institute_affiliations" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_affiliations_app_insert" ON "institute_affiliations" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_affiliations_app_update" ON "institute_affiliations" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_affiliations_app_delete" ON "institute_affiliations" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_affiliations_reseller_read" ON "institute_affiliations" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_affiliations_admin_all" ON "institute_affiliations" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_branding_app_select" ON "institute_branding" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "institute_branding_app_select_trash" ON "institute_branding" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_branding_app_insert" ON "institute_branding" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_branding_app_update" ON "institute_branding" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_branding_app_delete" ON "institute_branding" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_branding_reseller_read" ON "institute_branding" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_branding_admin_all" ON "institute_branding" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_configs_app_select" ON "institute_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "institute_configs_app_select_trash" ON "institute_configs" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_configs_app_insert" ON "institute_configs" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_configs_app_update" ON "institute_configs" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_configs_app_delete" ON "institute_configs" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_configs_reseller_read" ON "institute_configs" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_configs_admin_all" ON "institute_configs" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_group_branding_app_select" ON "institute_group_branding" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "institute_group_branding_app_select_trash" ON "institute_group_branding" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_group_branding_app_insert" ON "institute_group_branding" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_group_branding_app_update" ON "institute_group_branding" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_group_branding_app_delete" ON "institute_group_branding" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_group_branding_admin_all" ON "institute_group_branding" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_groups_app_select" ON "institute_groups" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "institute_groups_app_select_trash" ON "institute_groups" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_groups_app_insert" ON "institute_groups" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_groups_app_update" ON "institute_groups" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_groups_app_delete" ON "institute_groups" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_groups_admin_all" ON "institute_groups" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institute_identifiers_app_select" ON "institute_identifiers" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "institute_identifiers_app_select_trash" ON "institute_identifiers" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institute_identifiers_app_insert" ON "institute_identifiers" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_identifiers_app_update" ON "institute_identifiers" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "institute_identifiers_app_delete" ON "institute_identifiers" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institute_identifiers_reseller_read" ON "institute_identifiers" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "institute_identifiers_admin_all" ON "institute_identifiers" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institutes_app_select" ON "institutes" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "institutes_app_select_trash" ON "institutes" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "institutes_app_insert" ON "institutes" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institutes_app_update" ON "institutes" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (deleted_at IS NULL) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institutes_app_delete" ON "institutes" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "institutes_admin_all" ON "institutes" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "institutes_reseller_all" ON "institutes" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "memberships_app_select" ON "memberships" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "memberships_app_select_trash" ON "memberships" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "memberships_app_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "memberships_app_update" ON "memberships" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "memberships_app_delete" ON "memberships" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "memberships_reseller_read" ON "memberships" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "memberships_admin_all" ON "memberships" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "profiles_app_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "profiles_app_select_trash" ON "profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "profiles_app_insert" ON "profiles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "profiles_app_update" ON "profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "profiles_app_delete" ON "profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "profiles_reseller_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "profiles_admin_all" ON "profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "roles_app_select" ON "roles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "roles_app_select_trash" ON "roles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "roles_app_insert" ON "roles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "roles_app_update" ON "roles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "roles_app_delete" ON "roles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "roles_reseller_read" ON "roles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "roles_admin_all" ON "roles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "section_subjects_app_select" ON "section_subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "section_subjects_app_select_trash" ON "section_subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "section_subjects_app_insert" ON "section_subjects" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "section_subjects_app_update" ON "section_subjects" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "section_subjects_app_delete" ON "section_subjects" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "section_subjects_reseller_read" ON "section_subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "section_subjects_admin_all" ON "section_subjects" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "sections_app_select" ON "sections" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "sections_app_select_trash" ON "sections" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "sections_app_insert" ON "sections" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "sections_app_update" ON "sections" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "sections_app_delete" ON "sections" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "sections_reseller_read" ON "sections" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "sections_admin_all" ON "sections" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "standard_subjects_app_select" ON "standard_subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "standard_subjects_app_select_trash" ON "standard_subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "standard_subjects_app_insert" ON "standard_subjects" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "standard_subjects_app_update" ON "standard_subjects" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "standard_subjects_app_delete" ON "standard_subjects" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "standard_subjects_reseller_read" ON "standard_subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "standard_subjects_admin_all" ON "standard_subjects" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "standards_app_select" ON "standards" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "standards_app_select_trash" ON "standards" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "standards_app_insert" ON "standards" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "standards_app_update" ON "standards" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "standards_app_delete" ON "standards" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "standards_reseller_read" ON "standards" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "standards_admin_all" ON "standards" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_guardians_app_select" ON "student_guardians" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "student_guardians_app_select_trash" ON "student_guardians" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "student_guardians_app_insert" ON "student_guardians" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_guardians_app_update" ON "student_guardians" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_guardians_app_delete" ON "student_guardians" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "student_guardians_reseller_read" ON "student_guardians" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "student_guardians_admin_all" ON "student_guardians" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "subjects_app_select" ON "subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "subjects_app_select_trash" ON "subjects" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "subjects_app_insert" ON "subjects" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "subjects_app_update" ON "subjects" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "subjects_app_delete" ON "subjects" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "subjects_reseller_read" ON "subjects" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "subjects_admin_all" ON "subjects" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);