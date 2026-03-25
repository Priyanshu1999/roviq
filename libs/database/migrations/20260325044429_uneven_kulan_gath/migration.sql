CREATE TYPE "BillingInterval" AS ENUM('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');--> statement-breakpoint
CREATE TYPE "GatewayConfigStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "InvoiceStatus" AS ENUM('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "PaymentMethod" AS ENUM('RAZORPAY', 'CASHFREE', 'UPI_P2P', 'UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE');--> statement-breakpoint
CREATE TYPE "PaymentStatus" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "PlanStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "SubscriptionStatus" AS ENUM('TRIALING', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "admission_applications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"enquiry_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"standard_id" uuid NOT NULL,
	"section_id" uuid,
	"form_data" jsonb DEFAULT '{}' NOT NULL,
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"is_rte_application" boolean DEFAULT false NOT NULL,
	"rte_lottery_rank" integer,
	"test_score" numeric(5,2),
	"interview_score" numeric(5,2),
	"merit_rank" integer,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"offer_accepted_at" timestamp with time zone,
	"student_profile_id" uuid,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "admission_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
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
--> statement-breakpoint
ALTER TABLE "application_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"template_content" text,
	"fields_schema" jsonb NOT NULL,
	"approval_chain" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "certificate_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"student_name" varchar(200) NOT NULL,
	"date_of_birth" date,
	"gender" varchar(10),
	"class_requested" varchar(20) NOT NULL,
	"academic_year_id" uuid,
	"parent_name" varchar(200) NOT NULL,
	"parent_phone" varchar(15) NOT NULL,
	"parent_email" varchar(320),
	"parent_relation" varchar(30) DEFAULT 'father',
	"source" varchar(30) DEFAULT 'walk_in' NOT NULL,
	"referred_by" varchar(200),
	"assigned_to" uuid,
	"previous_school" varchar(255),
	"previous_board" varchar(50),
	"sibling_in_school" boolean DEFAULT false,
	"sibling_admission_no" varchar(30),
	"special_needs" text,
	"notes" text,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"follow_up_date" date,
	"last_contacted_at" timestamp with time zone,
	"converted_to_application_id" uuid,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issued_certificates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"template_id" uuid NOT NULL,
	"student_profile_id" uuid,
	"staff_profile_id" uuid,
	"serial_number" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"certificate_data" jsonb NOT NULL,
	"pdf_url" text,
	"issued_date" date,
	"issued_by" uuid,
	"purpose" varchar(255),
	"valid_until" date,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_certificate_status" CHECK ("status" IN ('draft', 'pending_approval', 'approved', 'issued', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "issued_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tc_register" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"student_profile_id" uuid NOT NULL,
	"tc_serial_number" varchar(50) NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"tc_data" jsonb DEFAULT '{}' NOT NULL,
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
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"original_tc_id" uuid,
	"duplicate_reason" text,
	"duplicate_fee" bigint,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_tc_status" CHECK ("status" IN (
        'requested', 'clearance_pending', 'clearance_complete',
        'generated', 'review_pending', 'approved', 'issued',
        'cancelled', 'duplicate_requested', 'duplicate_issued'
      ))
);
--> statement-breakpoint
ALTER TABLE "tc_register" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_children" (
	"parent_group_id" uuid,
	"child_group_id" uuid,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "group_children_pkey" PRIMARY KEY("parent_group_id","child_group_id"),
	CONSTRAINT "chk_no_self_ref" CHECK ("parent_group_id" != "child_group_id")
);
--> statement-breakpoint
ALTER TABLE "group_children" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"group_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"source" varchar(10) NOT NULL,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "chk_member_source" CHECK ("source" IN ('manual', 'rule', 'inherited'))
);
--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"group_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule" jsonb NOT NULL,
	"rule_dimensions" text[] NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(200) NOT NULL,
	"description" text,
	"group_type" varchar(20) NOT NULL,
	"membership_type" varchar(10) DEFAULT 'dynamic' NOT NULL,
	"member_types" text[] DEFAULT '{student}'::text[] NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"resolved_at" timestamp with time zone,
	"member_count" integer DEFAULT 0,
	"parent_group_id" uuid,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_group_type" CHECK ("group_type" IN (
        'class', 'section', 'house', 'club', 'sports_team', 'bus_route',
        'subject', 'stream', 'fee', 'exam', 'notification', 'activity',
        'department', 'committee', 'composite', 'custom'
      )),
	CONSTRAINT "chk_membership_type" CHECK ("membership_type" IN ('static', 'dynamic', 'hybrid')),
	CONSTRAINT "chk_group_status" CHECK ("status" IN ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bot_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL UNIQUE,
	"bot_type" varchar(30) NOT NULL,
	"api_key_hash" text,
	"api_key_prefix" varchar(12),
	"api_key_expires_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"rate_limit_tier" varchar(10) DEFAULT 'low',
	"config" jsonb DEFAULT '{}',
	"webhook_url" text,
	"is_system_bot" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_bot_type" CHECK ("bot_type" IN (
        'system_notification', 'fee_reminder', 'attendance_notification',
        'homework_reminder', 'ai_chatbot_parent', 'ai_chatbot_student',
        'integration', 'report_generation', 'bulk_operation', 'admission_chatbot'
      )),
	CONSTRAINT "chk_rate_limit_tier" CHECK ("rate_limit_tier" IS NULL OR "rate_limit_tier" IN ('low', 'medium', 'high')),
	CONSTRAINT "chk_bot_status" CHECK ("status" IN ('active', 'suspended', 'deactivated'))
);
--> statement-breakpoint
ALTER TABLE "bot_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
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
--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guardian_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL UNIQUE,
	"occupation" varchar(100),
	"organization" varchar(200),
	"designation" varchar(100),
	"annual_income" bigint,
	"education_level" varchar(50),
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_education_level" CHECK ("education_level" IS NULL OR "education_level" IN (
        'illiterate', 'primary', 'secondary', 'graduate', 'post_graduate', 'professional'
      ))
);
--> statement-breakpoint
ALTER TABLE "guardian_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "privacy_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "privacy_notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL UNIQUE,
	"employee_id" varchar(30),
	"designation" varchar(100),
	"department" varchar(50),
	"date_of_joining" date,
	"date_of_leaving" date,
	"leaving_reason" varchar(100),
	"employment_type" varchar(20) DEFAULT 'regular',
	"is_class_teacher" boolean DEFAULT false NOT NULL,
	"trained_for_cwsn" boolean DEFAULT false NOT NULL,
	"nature_of_appointment" varchar(30),
	"social_category" varchar(10),
	"is_disabled" boolean DEFAULT false NOT NULL,
	"disability_type" varchar(60),
	"specialization" varchar(100),
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_employment_type" CHECK ("employment_type" IS NULL OR "employment_type" IN (
        'regular', 'contractual', 'part_time', 'guest', 'volunteer'
      )),
	CONSTRAINT "chk_staff_social_category" CHECK ("social_category" IS NULL OR "social_category" IN (
        'general', 'sc', 'st', 'obc', 'ews'
      ))
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
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
	CONSTRAINT "chk_qualification_type" CHECK ("type" IN ('academic', 'professional'))
);
--> statement-breakpoint
ALTER TABLE "staff_qualifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_academics" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_promotion_status" CHECK ("promotion_status" IS NULL OR "promotion_status" IN (
        'pending', 'promoted', 'detained', 'graduated', 'transferred'
      ))
);
--> statement-breakpoint
ALTER TABLE "student_academics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_guardian_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"guardian_profile_id" uuid NOT NULL,
	"relationship" varchar(30) NOT NULL,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"can_pickup" boolean DEFAULT true NOT NULL,
	"lives_with" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_relationship" CHECK ("relationship" IN (
        'father', 'mother', 'legal_guardian', 'grandparent_paternal',
        'grandparent_maternal', 'uncle', 'aunt', 'sibling', 'other'
      ))
);
--> statement-breakpoint
ALTER TABLE "student_guardian_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL UNIQUE,
	"admission_number" varchar(30) NOT NULL,
	"admission_date" date NOT NULL,
	"admission_class" varchar(20),
	"admission_type" varchar(20) DEFAULT 'new' NOT NULL,
	"academic_status" varchar(20) DEFAULT 'enrolled' NOT NULL,
	"social_category" varchar(10) DEFAULT 'general' NOT NULL,
	"caste" varchar(100),
	"is_minority" boolean DEFAULT false NOT NULL,
	"minority_type" varchar(20),
	"is_bpl" boolean DEFAULT false NOT NULL,
	"is_cwsn" boolean DEFAULT false NOT NULL,
	"cwsn_type" varchar(60),
	"is_rte_admitted" boolean DEFAULT false NOT NULL,
	"rte_certificate" varchar(50),
	"previous_school_name" varchar(255),
	"previous_school_board" varchar(50),
	"previous_school_udise" char(11),
	"incoming_tc_number" varchar(50),
	"incoming_tc_date" date,
	"tc_issued" boolean DEFAULT false NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_admission_type" CHECK ("admission_type" IN ('new', 'rte', 'lateral_entry', 're_admission', 'transfer')),
	CONSTRAINT "chk_academic_status" CHECK ("academic_status" IN (
        'enrolled', 'promoted', 'detained', 'graduated',
        'transferred_out', 'dropped_out', 'withdrawn', 'suspended', 'expelled',
        're_enrolled', 'passout'
      )),
	CONSTRAINT "chk_social_category" CHECK ("social_category" IN ('general', 'sc', 'st', 'obc', 'ews')),
	CONSTRAINT "chk_minority_type" CHECK ("minority_type" IS NULL OR "minority_type" IN (
        'muslim', 'christian', 'sikh', 'buddhist', 'parsi', 'jain', 'other'
      )),
	CONSTRAINT "chk_stream" CHECK ("stream" IS NULL OR "stream" IN (
        'science_pcm', 'science_pcb', 'commerce', 'arts', 'vocational'
      ))
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"reseller_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"status" "GatewayConfigStatus" DEFAULT 'ACTIVE'::"GatewayConfigStatus" NOT NULL,
	"display_name" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"credentials" jsonb,
	"webhook_secret" text,
	"test_mode" boolean DEFAULT false NOT NULL,
	"supported_methods" jsonb DEFAULT '[]' NOT NULL,
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
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"reseller_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"status" "InvoiceStatus" DEFAULT 'DRAFT'::"InvoiceStatus" NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"line_items" jsonb DEFAULT '[]' NOT NULL,
	"tax_breakdown" jsonb,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"invoice_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reseller_id" uuid NOT NULL,
	"status" "PaymentStatus" DEFAULT 'PENDING'::"PaymentStatus" NOT NULL,
	"method" "PaymentMethod" NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"gateway_provider" varchar(50),
	"gateway_payment_id" varchar(255),
	"gateway_order_id" varchar(255),
	"gateway_response" jsonb,
	"receipt_number" varchar(50),
	"refunded_amount_paise" bigint DEFAULT 0 NOT NULL,
	"refunded_at" timestamp with time zone,
	"refund_reason" text,
	"refund_gateway_id" varchar(255),
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"notes" text,
	"metadata" jsonb,
	"collected_by_id" uuid,
	"collection_date" date,
	"utr_number" varchar(50),
	"verification_status" varchar(30),
	"verification_deadline" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"reseller_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"code" varchar(50) NOT NULL,
	"status" "PlanStatus" DEFAULT 'ACTIVE'::"PlanStatus" NOT NULL,
	"interval" "BillingInterval" NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"entitlements" jsonb DEFAULT '{"maxStudents":null,"maxStaff":null,"maxStorageMb":null,"auditLogRetentionDays":90,"features":[]}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reseller_invoice_sequences" (
	"reseller_id" uuid PRIMARY KEY,
	"current_year" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reseller_invoice_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"reseller_id" uuid NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'ACTIVE'::"SubscriptionStatus" NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"gateway_subscription_id" varchar(255),
	"gateway_provider" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "search_vector";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') || setweight(to_tsvector('simple', coalesce(last_name, '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "user_identifiers" ALTER COLUMN "valid_from" SET DATA TYPE date USING "valid_from"::date;--> statement-breakpoint
ALTER TABLE "user_identifiers" ALTER COLUMN "valid_to" SET DATA TYPE date USING "valid_to"::date;--> statement-breakpoint
CREATE INDEX "idx_applications_status" ON "admission_applications" ("tenant_id","status") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_applications_academic_year" ON "admission_applications" ("tenant_id","academic_year_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_application_documents_app" ON "application_documents" ("application_id");--> statement-breakpoint
CREATE INDEX "idx_enquiries_status" ON "enquiries" ("tenant_id","status","follow_up_date") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_enquiries_search" ON "enquiries" USING gin (to_tsvector('simple', coalesce(student_name, '') || ' ' || coalesce(parent_name, '')));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_certificate_serial" ON "issued_certificates" ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "idx_issued_certificates_student" ON "issued_certificates" ("student_profile_id");--> statement-breakpoint
CREATE INDEX "idx_issued_certificates_staff" ON "issued_certificates" ("staff_profile_id");--> statement-breakpoint
CREATE INDEX "idx_issued_certificates_tenant_status" ON "issued_certificates" ("tenant_id","status") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tc_serial" ON "tc_register" ("tenant_id","tc_serial_number");--> statement-breakpoint
CREATE INDEX "idx_tc_register_tenant_status" ON "tc_register" ("tenant_id","status") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tc_register_student" ON "tc_register" ("student_profile_id");--> statement-breakpoint
CREATE INDEX "idx_group_children_tenant" ON "group_children" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_member" ON "group_members" ("group_id","membership_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_group" ON "group_members" ("group_id") WHERE "is_excluded" = false;--> statement-breakpoint
CREATE INDEX "idx_group_members_membership" ON "group_members" ("membership_id");--> statement-breakpoint
CREATE INDEX "idx_group_rules_group" ON "group_rules" ("group_id");--> statement-breakpoint
CREATE INDEX "idx_group_rules_tenant" ON "group_rules" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_name_active" ON "groups" ("tenant_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_bot_profiles_tenant" ON "bot_profiles" ("tenant_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_consent_guardian" ON "consent_records" ("guardian_profile_id","purpose");--> statement-breakpoint
CREATE INDEX "idx_consent_student" ON "consent_records" ("student_profile_id","purpose");--> statement-breakpoint
CREATE INDEX "idx_guardian_profiles_tenant" ON "guardian_profiles" ("tenant_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notice_version" ON "privacy_notices" ("tenant_id","version","language");--> statement-breakpoint
CREATE INDEX "idx_staff_profiles_tenant" ON "staff_profiles" ("tenant_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_staff_qualifications_profile" ON "staff_qualifications" ("staff_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_student_academic_year" ON "student_academics" ("student_profile_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "idx_student_academics_section" ON "student_academics" ("tenant_id","academic_year_id","section_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_student_academics_standard" ON "student_academics" ("tenant_id","academic_year_id","standard_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_student_guardian" ON "student_guardian_links" ("student_profile_id","guardian_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_primary_contact" ON "student_guardian_links" ("student_profile_id") WHERE "is_primary_contact" = true;--> statement-breakpoint
CREATE INDEX "idx_guardian_students" ON "student_guardian_links" ("guardian_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_admission_no_active" ON "student_profiles" ("tenant_id","admission_number") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_student_profiles_tenant_status" ON "student_profiles" ("tenant_id","academic_status") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_student_profiles_membership" ON "student_profiles" ("membership_id");--> statement-breakpoint
CREATE INDEX "idx_student_profiles_admission_trgm" ON "student_profiles" USING gin (admission_number gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "gwc_reseller_id_idx" ON "payment_gateway_configs" ("reseller_id");--> statement-breakpoint
CREATE INDEX "gwc_reseller_provider_idx" ON "payment_gateway_configs" ("reseller_id","provider");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_idx" ON "invoices" ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" ("subscription_id");--> statement-breakpoint
CREATE INDEX "invoices_reseller_id_idx" ON "invoices" ("reseller_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" ("status");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_id_idx" ON "payments" ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_reseller_id_idx" ON "payments" ("reseller_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" ("status");--> statement-breakpoint
CREATE INDEX "plans_reseller_id_idx" ON "plans" ("reseller_id");--> statement-breakpoint
CREATE INDEX "plans_status_idx" ON "plans" ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions" ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_reseller_id_idx" ON "subscriptions" ("reseller_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" ("status");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_search" ON "user_profiles" USING gin (search_vector);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_enquiry_id_enquiries_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_standard_id_standards_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_6cdbMAv5hrpA_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_WgmkSIF9SKRI_fkey" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_verified_by_users_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_template_id_certificate_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_student_profile_id_student_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id");--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_staff_profile_id_staff_profiles_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id");--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_issued_by_users_id_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_student_profile_id_student_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_reviewed_by_users_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "tc_register" ADD CONSTRAINT "tc_register_original_tc_id_tc_register_id_fkey" FOREIGN KEY ("original_tc_id") REFERENCES "tc_register"("id");--> statement-breakpoint
ALTER TABLE "group_children" ADD CONSTRAINT "group_children_parent_group_id_groups_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_children" ADD CONSTRAINT "group_children_child_group_id_groups_id_fkey" FOREIGN KEY ("child_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_children" ADD CONSTRAINT "group_children_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_groups_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id");--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_guardian_profile_id_guardian_profiles_id_fkey" FOREIGN KEY ("guardian_profile_id") REFERENCES "guardian_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_student_profile_id_student_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_privacy_notice_id_privacy_notices_id_fkey" FOREIGN KEY ("privacy_notice_id") REFERENCES "privacy_notices"("id");--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "guardian_profiles" ADD CONSTRAINT "guardian_profiles_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "privacy_notices" ADD CONSTRAINT "privacy_notices_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_staff_profile_id_staff_profiles_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_student_profile_id_student_profiles_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_standard_id_standards_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_promoted_to_standard_id_standards_id_fkey" FOREIGN KEY ("promoted_to_standard_id") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_academics" ADD CONSTRAINT "student_academics_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_GCqIVzPVwLIW_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_r7usGhO98cSy_fkey" FOREIGN KEY ("guardian_profile_id") REFERENCES "guardian_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardian_links" ADD CONSTRAINT "student_guardian_links_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_id_memberships_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_id_memberships_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "reseller_invoice_sequences" ADD CONSTRAINT "reseller_invoice_sequences_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "admission_applications_app_select" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "admission_applications_app_select_trash" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "admission_applications_app_insert" ON "admission_applications" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "admission_applications_app_update" ON "admission_applications" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "admission_applications_app_delete" ON "admission_applications" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "admission_applications_reseller_read" ON "admission_applications" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "admission_applications_admin_all" ON "admission_applications" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "application_documents_app_select" ON "application_documents" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "application_documents_app_insert" ON "application_documents" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "application_documents_app_update" ON "application_documents" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "application_documents_app_delete" ON "application_documents" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "application_documents_reseller_read" ON "application_documents" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "application_documents_admin_all" ON "application_documents" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "certificate_templates_app_select" ON "certificate_templates" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "certificate_templates_app_insert" ON "certificate_templates" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "certificate_templates_app_update" ON "certificate_templates" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "certificate_templates_app_delete" ON "certificate_templates" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "certificate_templates_reseller_read" ON "certificate_templates" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "certificate_templates_admin_all" ON "certificate_templates" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "enquiries_app_select" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "enquiries_app_select_trash" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "enquiries_app_insert" ON "enquiries" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "enquiries_app_update" ON "enquiries" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "enquiries_app_delete" ON "enquiries" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "enquiries_reseller_read" ON "enquiries" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "enquiries_admin_all" ON "enquiries" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "issued_certificates_app_select" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "issued_certificates_app_select_trash" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "issued_certificates_app_insert" ON "issued_certificates" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "issued_certificates_app_update" ON "issued_certificates" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "issued_certificates_app_delete" ON "issued_certificates" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "issued_certificates_reseller_read" ON "issued_certificates" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "issued_certificates_admin_all" ON "issued_certificates" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "tc_register_app_select" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "tc_register_app_select_trash" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "tc_register_app_insert" ON "tc_register" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "tc_register_app_update" ON "tc_register" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "tc_register_app_delete" ON "tc_register" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "tc_register_reseller_read" ON "tc_register" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "tc_register_admin_all" ON "tc_register" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "group_children_app_select" ON "group_children" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_children_app_insert" ON "group_children" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_children_app_update" ON "group_children" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_children_app_delete" ON "group_children" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "group_children_reseller_read" ON "group_children" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "group_children_admin_all" ON "group_children" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "group_members_app_select" ON "group_members" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_members_app_insert" ON "group_members" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_members_app_update" ON "group_members" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_members_app_delete" ON "group_members" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "group_members_reseller_read" ON "group_members" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "group_members_admin_all" ON "group_members" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "group_rules_app_select" ON "group_rules" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_rules_app_insert" ON "group_rules" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_rules_app_update" ON "group_rules" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "group_rules_app_delete" ON "group_rules" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "group_rules_reseller_read" ON "group_rules" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "group_rules_admin_all" ON "group_rules" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "groups_app_select" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "groups_app_select_trash" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "groups_app_insert" ON "groups" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "groups_app_update" ON "groups" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "groups_app_delete" ON "groups" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "groups_reseller_read" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "groups_admin_all" ON "groups" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "bot_profiles_app_select" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "bot_profiles_app_select_trash" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "bot_profiles_app_insert" ON "bot_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "bot_profiles_app_update" ON "bot_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "bot_profiles_app_delete" ON "bot_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "bot_profiles_reseller_read" ON "bot_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "bot_profiles_admin_all" ON "bot_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "consent_records_app_select" ON "consent_records" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "consent_records_app_insert" ON "consent_records" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "consent_records_app_update" ON "consent_records" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "consent_records_app_delete" ON "consent_records" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "consent_records_reseller_read" ON "consent_records" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
        SELECT id FROM institutes
        WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
      ));--> statement-breakpoint
CREATE POLICY "consent_records_admin_all" ON "consent_records" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "guardian_profiles_app_select" ON "guardian_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "guardian_profiles_app_select_trash" ON "guardian_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "guardian_profiles_app_insert" ON "guardian_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "guardian_profiles_app_update" ON "guardian_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "guardian_profiles_app_delete" ON "guardian_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "guardian_profiles_reseller_read" ON "guardian_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "guardian_profiles_admin_all" ON "guardian_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "privacy_notices_app_select" ON "privacy_notices" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "privacy_notices_app_insert" ON "privacy_notices" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "privacy_notices_app_update" ON "privacy_notices" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "privacy_notices_app_delete" ON "privacy_notices" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "privacy_notices_reseller_read" ON "privacy_notices" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "privacy_notices_admin_all" ON "privacy_notices" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "staff_profiles_app_select" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "staff_profiles_app_select_trash" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "staff_profiles_app_insert" ON "staff_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "staff_profiles_app_update" ON "staff_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "staff_profiles_app_delete" ON "staff_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "staff_profiles_reseller_read" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "staff_profiles_admin_all" ON "staff_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "staff_qualifications_app_select" ON "staff_qualifications" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "staff_qualifications_app_insert" ON "staff_qualifications" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "staff_qualifications_app_update" ON "staff_qualifications" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "staff_qualifications_app_delete" ON "staff_qualifications" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "staff_qualifications_reseller_read" ON "staff_qualifications" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "staff_qualifications_admin_all" ON "staff_qualifications" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_academics_app_select" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "student_academics_app_select_trash" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "student_academics_app_insert" ON "student_academics" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_academics_app_update" ON "student_academics" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_academics_app_delete" ON "student_academics" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "student_academics_reseller_read" ON "student_academics" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "student_academics_admin_all" ON "student_academics" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_guardian_links_app_select" ON "student_guardian_links" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "student_guardian_links_app_insert" ON "student_guardian_links" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "student_guardian_links_app_update" ON "student_guardian_links" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "student_guardian_links_app_delete" ON "student_guardian_links" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "student_guardian_links_reseller_read" ON "student_guardian_links" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "student_guardian_links_admin_all" ON "student_guardian_links" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_profiles_app_select" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    );--> statement-breakpoint
CREATE POLICY "student_profiles_app_select_trash" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    );--> statement-breakpoint
CREATE POLICY "student_profiles_app_insert" ON "student_profiles" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_profiles_app_update" ON "student_profiles" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "student_profiles_app_delete" ON "student_profiles" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "student_profiles_reseller_read" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "student_profiles_admin_all" ON "student_profiles" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "gwc_reseller_all" ON "payment_gateway_configs" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid AND deleted_at IS NULL) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "gwc_admin_all" ON "payment_gateway_configs" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "inv_app_read" ON "invoices" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "inv_reseller_all" ON "invoices" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "inv_admin_all" ON "invoices" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "pay_app_read" ON "payments" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "pay_reseller_all" ON "payments" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "pay_admin_all" ON "payments" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "plan_reseller_all" ON "plans" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid AND deleted_at IS NULL) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "plan_reseller_trash" ON "plans" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (
        reseller_id = current_setting('app.current_reseller_id', true)::uuid
        AND deleted_at IS NOT NULL
        AND current_setting('app.include_deleted', true) = 'true'
      );--> statement-breakpoint
CREATE POLICY "plan_app_read" ON "plans" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
        id IN (
          SELECT plan_id FROM subscriptions
          WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
        AND deleted_at IS NULL
      );--> statement-breakpoint
CREATE POLICY "plan_admin_all" ON "plans" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "seq_reseller_all" ON "reseller_invoice_sequences" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "seq_admin_all" ON "reseller_invoice_sequences" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "sub_app_read" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "sub_reseller_all" ON "subscriptions" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "sub_admin_all" ON "subscriptions" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);