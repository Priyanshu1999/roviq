CREATE TYPE "AcademicStatus" AS ENUM('ENROLLED', 'PROMOTED', 'DETAINED', 'GRADUATED', 'TRANSFERRED_OUT', 'DROPPED_OUT', 'WITHDRAWN', 'SUSPENDED', 'EXPELLED', 'RE_ENROLLED', 'PASSOUT');--> statement-breakpoint
CREATE TYPE "AddressType" AS ENUM('PERMANENT', 'CURRENT', 'EMERGENCY');--> statement-breakpoint
CREATE TYPE "AdmissionApplicationStatus" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'DOCUMENTS_VERIFIED', 'TEST_SCHEDULED', 'TEST_COMPLETED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'MERIT_LISTED', 'OFFER_MADE', 'OFFER_ACCEPTED', 'FEE_PENDING', 'FEE_PAID', 'ENROLLED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "AdmissionType" AS ENUM('NEW', 'LATERAL_ENTRY', 'RE_ADMISSION', 'TRANSFER');--> statement-breakpoint
CREATE TYPE "AttendanceMode" AS ENUM('MANUAL', 'APP', 'BIOMETRIC', 'IMPORT');--> statement-breakpoint
CREATE TYPE "AttendanceStatus" AS ENUM('PRESENT', 'ABSENT', 'LEAVE', 'LATE');--> statement-breakpoint
CREATE TYPE "BotRateLimitTier" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "BotStatus" AS ENUM('ACTIVE', 'SUSPENDED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "BotType" AS ENUM('SYSTEM_NOTIFICATION', 'FEE_REMINDER', 'ATTENDANCE_NOTIFICATION', 'HOMEWORK_REMINDER', 'AI_CHATBOT_PARENT', 'AI_CHATBOT_STUDENT', 'INTEGRATION', 'REPORT_GENERATION', 'BULK_OPERATION', 'ADMISSION_CHATBOT');--> statement-breakpoint
CREATE TYPE "CertificateStatus" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "CertificateTemplateType" AS ENUM('TRANSFER_CERTIFICATE', 'CHARACTER_CERTIFICATE', 'BONAFIDE_CERTIFICATE', 'SCHOOL_LEAVING_CERTIFICATE', 'STUDY_CERTIFICATE', 'DOB_CERTIFICATE', 'NO_DUES_CERTIFICATE', 'RAILWAY_CONCESSION', 'ATTENDANCE_CERTIFICATE', 'CONDUCT_CERTIFICATE', 'SPORTS_CERTIFICATE', 'MERIT_CERTIFICATE', 'PROVISIONAL_CERTIFICATE', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "DomainGroupType" AS ENUM('CLASS', 'SECTION', 'HOUSE', 'CLUB', 'SPORTS_TEAM', 'BUS_ROUTE', 'SUBJECT', 'STREAM', 'FEE', 'EXAM', 'NOTIFICATION', 'ACTIVITY', 'DEPARTMENT', 'COMMITTEE', 'COMPOSITE', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "DynamicGroupStatus" AS ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "EmploymentType" AS ENUM('REGULAR', 'CONTRACTUAL', 'PART_TIME', 'GUEST', 'VOLUNTEER');--> statement-breakpoint
CREATE TYPE "EnquirySource" AS ENUM('WALK_IN', 'PHONE', 'WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'NEWSPAPER_AD', 'HOARDING', 'SCHOOL_EVENT', 'ALUMNI', 'GOOGLE', 'WHATSAPP', 'OTHER');--> statement-breakpoint
CREATE TYPE "EnquiryStatus" AS ENUM('NEW', 'CONTACTED', 'CAMPUS_VISIT_SCHEDULED', 'CAMPUS_VISITED', 'APPLICATION_ISSUED', 'APPLICATION_SUBMITTED', 'TEST_SCHEDULED', 'OFFER_MADE', 'FEE_PAID', 'ENROLLED', 'LOST', 'DROPPED');--> statement-breakpoint
CREATE TYPE "Gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "GroupMemberSource" AS ENUM('MANUAL', 'RULE', 'INHERITED');--> statement-breakpoint
CREATE TYPE "GroupMembershipType" AS ENUM('STATIC', 'DYNAMIC', 'HYBRID');--> statement-breakpoint
CREATE TYPE "GuardianEducationLevel" AS ENUM('ILLITERATE', 'PRIMARY', 'SECONDARY', 'GRADUATE', 'POST_GRADUATE', 'PROFESSIONAL');--> statement-breakpoint
CREATE TYPE "GuardianRelationship" AS ENUM('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'GRANDPARENT_PATERNAL', 'GRANDPARENT_MATERNAL', 'UNCLE', 'AUNT', 'SIBLING', 'OTHER');--> statement-breakpoint
CREATE TYPE "HolidayType" AS ENUM('NATIONAL', 'STATE', 'RELIGIOUS', 'INSTITUTE', 'SUMMER_BREAK', 'WINTER_BREAK', 'OTHER');--> statement-breakpoint
CREATE TYPE "LeaveStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "LeaveType" AS ENUM('MEDICAL', 'CASUAL', 'BEREAVEMENT', 'EXAM', 'OTHER');--> statement-breakpoint
CREATE TYPE "MinorityType" AS ENUM('MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'PARSI', 'JAIN', 'OTHER');--> statement-breakpoint
CREATE TYPE "PromotionStatus" AS ENUM('PENDING', 'PROMOTED', 'DETAINED', 'GRADUATED', 'TRANSFERRED');--> statement-breakpoint
CREATE TYPE "QualificationType" AS ENUM('ACADEMIC', 'PROFESSIONAL');--> statement-breakpoint
CREATE TYPE "SocialCategory" AS ENUM('GENERAL', 'SC', 'ST', 'OBC', 'EWS');--> statement-breakpoint
CREATE TYPE "StudentStream" AS ENUM('SCIENCE_PCM', 'SCIENCE_PCB', 'COMMERCE', 'ARTS', 'VOCATIONAL');--> statement-breakpoint
CREATE TYPE "TcStatus" AS ENUM('REQUESTED', 'CLEARANCE_PENDING', 'CLEARANCE_COMPLETE', 'GENERATED', 'REVIEW_PENDING', 'APPROVED', 'ISSUED', 'CANCELLED', 'DUPLICATE_REQUESTED', 'DUPLICATE_ISSUED');--> statement-breakpoint
CREATE TYPE "UserDocumentType" AS ENUM('BIRTH_CERTIFICATE', 'TC_INCOMING', 'REPORT_CARD', 'AADHAAR_CARD', 'CASTE_CERTIFICATE', 'INCOME_CERTIFICATE', 'EWS_CERTIFICATE', 'MEDICAL_CERTIFICATE', 'DISABILITY_CERTIFICATE', 'ADDRESS_PROOF', 'PASSPORT_PHOTO', 'FAMILY_PHOTO', 'BPL_CARD', 'TRANSFER_ORDER', 'NOC', 'AFFIDAVIT', 'OTHER');--> statement-breakpoint
CREATE TYPE "UserIdentifierType" AS ENUM('AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'APAAR', 'PEN', 'CBSE_REGISTRATION', 'BSEH_ENROLLMENT', 'SHALA_DARPAN_ID', 'PARIVAR_PEHCHAN_PATRA', 'JAN_AADHAAR', 'MIGRATION_CERTIFICATE');--> statement-breakpoint
CREATE TABLE "attendance_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "AttendanceStatus" NOT NULL,
	"mode" "AttendanceMode" DEFAULT 'MANUAL'::"AttendanceMode" NOT NULL,
	"remarks" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
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
ALTER TABLE "attendance_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"section_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"date" date NOT NULL,
	"period" integer,
	"subject_id" uuid,
	"lecturer_id" uuid NOT NULL,
	"override_check" boolean DEFAULT false NOT NULL,
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
ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" jsonb NOT NULL,
	"description" text,
	"type" "HolidayType" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
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
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" "LeaveType" NOT NULL,
	"reason" text NOT NULL,
	"status" "LeaveStatus" DEFAULT 'PENDING'::"LeaveStatus" NOT NULL,
	"file_urls" jsonb DEFAULT '[]' NOT NULL,
	"decided_by" uuid,
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
ALTER TABLE "leaves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "plan_reseller_all" ON "plans";--> statement-breakpoint
ALTER TABLE "admission_applications" DROP CONSTRAINT "chk_application_status";--> statement-breakpoint
ALTER TABLE "certificate_templates" DROP CONSTRAINT "chk_certificate_type";--> statement-breakpoint
ALTER TABLE "enquiries" DROP CONSTRAINT "chk_enquiry_source";--> statement-breakpoint
ALTER TABLE "enquiries" DROP CONSTRAINT "chk_enquiry_status";--> statement-breakpoint
ALTER TABLE "issued_certificates" DROP CONSTRAINT "chk_certificate_status";--> statement-breakpoint
ALTER TABLE "tc_register" DROP CONSTRAINT "chk_tc_status";--> statement-breakpoint
ALTER TABLE "group_members" DROP CONSTRAINT "chk_member_source";--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "chk_group_type";--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "chk_membership_type";--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "chk_group_status";--> statement-breakpoint
ALTER TABLE "bot_profiles" DROP CONSTRAINT "chk_bot_type";--> statement-breakpoint
ALTER TABLE "bot_profiles" DROP CONSTRAINT "chk_rate_limit_tier";--> statement-breakpoint
ALTER TABLE "bot_profiles" DROP CONSTRAINT "chk_bot_status";--> statement-breakpoint
ALTER TABLE "guardian_profiles" DROP CONSTRAINT "chk_education_level";--> statement-breakpoint
ALTER TABLE "staff_profiles" DROP CONSTRAINT "chk_employment_type";--> statement-breakpoint
ALTER TABLE "staff_profiles" DROP CONSTRAINT "chk_staff_social_category";--> statement-breakpoint
ALTER TABLE "staff_qualifications" DROP CONSTRAINT "chk_qualification_type";--> statement-breakpoint
ALTER TABLE "student_academics" DROP CONSTRAINT "chk_promotion_status";--> statement-breakpoint
ALTER TABLE "student_guardian_links" DROP CONSTRAINT "chk_relationship";--> statement-breakpoint
ALTER TABLE "student_profiles" DROP CONSTRAINT "chk_academic_status";--> statement-breakpoint
ALTER TABLE "student_profiles" DROP CONSTRAINT "chk_social_category";--> statement-breakpoint
ALTER TABLE "student_profiles" DROP CONSTRAINT "chk_minority_type";--> statement-breakpoint
ALTER TABLE "student_profiles" DROP CONSTRAINT "chk_stream";--> statement-breakpoint
ALTER TABLE "user_addresses" DROP CONSTRAINT "chk_address_type";--> statement-breakpoint
ALTER TABLE "user_documents" DROP CONSTRAINT "chk_document_type";--> statement-breakpoint
ALTER TABLE "user_identifiers" DROP CONSTRAINT "chk_identifier_type";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP CONSTRAINT "chk_gender";--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "enquiry_number" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "require_impersonation_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "primary_nav_slugs" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "institute_configs" ALTER COLUMN "attendance_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "institute_configs" ALTER COLUMN "attendance_type" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "AttendanceType";--> statement-breakpoint
CREATE TYPE "AttendanceType" AS ENUM('DAILY', 'LECTURE_WISE');--> statement-breakpoint
ALTER TABLE "institute_configs" ALTER COLUMN "attendance_type" SET DATA TYPE "AttendanceType" USING "attendance_type"::"AttendanceType";--> statement-breakpoint
ALTER TABLE "institute_configs" ALTER COLUMN "attendance_type" SET DEFAULT 'DAILY'::"AttendanceType";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "search_vector";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(i18n_text_to_string(first_name), '')), 'A') || setweight(to_tsvector('simple', coalesce(i18n_text_to_string(last_name), '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "name_local";--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "status" SET DATA TYPE "AdmissionApplicationStatus" USING "status"::"AdmissionApplicationStatus";--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"AdmissionApplicationStatus";--> statement-breakpoint
ALTER TABLE "certificate_templates" ALTER COLUMN "type" SET DATA TYPE "CertificateTemplateType" USING "type"::"CertificateTemplateType";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "parent_relation" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "parent_relation" SET DATA TYPE "GuardianRelationship" USING "parent_relation"::"GuardianRelationship";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "parent_relation" SET DEFAULT 'FATHER'::"GuardianRelationship";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "source" SET DATA TYPE "EnquirySource" USING "source"::"EnquirySource";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "source" SET DEFAULT 'WALK_IN'::"EnquirySource";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "status" SET DATA TYPE "EnquiryStatus" USING "status"::"EnquiryStatus";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "status" SET DEFAULT 'NEW'::"EnquiryStatus";--> statement-breakpoint
ALTER TABLE "issued_certificates" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "issued_certificates" ALTER COLUMN "status" SET DATA TYPE "CertificateStatus" USING "status"::"CertificateStatus";--> statement-breakpoint
ALTER TABLE "issued_certificates" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"CertificateStatus";--> statement-breakpoint
ALTER TABLE "tc_register" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tc_register" ALTER COLUMN "status" SET DATA TYPE "TcStatus" USING "status"::"TcStatus";--> statement-breakpoint
ALTER TABLE "tc_register" ALTER COLUMN "status" SET DEFAULT 'REQUESTED'::"TcStatus";--> statement-breakpoint
ALTER TABLE "group_members" ALTER COLUMN "source" SET DATA TYPE "GroupMemberSource" USING "source"::"GroupMemberSource";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "group_type" SET DATA TYPE "DomainGroupType" USING "group_type"::"DomainGroupType";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "membership_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "membership_type" SET DATA TYPE "GroupMembershipType" USING "membership_type"::"GroupMembershipType";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "membership_type" SET DEFAULT 'DYNAMIC'::"GroupMembershipType";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "status" SET DATA TYPE "DynamicGroupStatus" USING "status"::"DynamicGroupStatus";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"DynamicGroupStatus";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "member_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "institutes" ALTER COLUMN "reseller_id" SET DEFAULT '00000000-0000-4000-a000-000000000011';--> statement-breakpoint
ALTER TABLE "sections" ALTER COLUMN "name" SET DATA TYPE jsonb USING "name"::jsonb;--> statement-breakpoint
ALTER TABLE "standards" ALTER COLUMN "name" SET DATA TYPE jsonb USING "name"::jsonb;--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "bot_type" SET DATA TYPE "BotType" USING "bot_type"::"BotType";--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "api_key_prefix" SET DATA TYPE varchar(14) USING "api_key_prefix"::varchar(14);--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "rate_limit_tier" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "rate_limit_tier" SET DATA TYPE "BotRateLimitTier" USING "rate_limit_tier"::"BotRateLimitTier";--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "rate_limit_tier" SET DEFAULT 'LOW'::"BotRateLimitTier";--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "status" SET DATA TYPE "BotStatus" USING "status"::"BotStatus";--> statement-breakpoint
ALTER TABLE "bot_profiles" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"BotStatus";--> statement-breakpoint
ALTER TABLE "guardian_profiles" ALTER COLUMN "education_level" SET DATA TYPE "GuardianEducationLevel" USING "education_level"::"GuardianEducationLevel";--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "employment_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "employment_type" SET DATA TYPE "EmploymentType" USING "employment_type"::"EmploymentType";--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "employment_type" SET DEFAULT 'REGULAR'::"EmploymentType";--> statement-breakpoint
ALTER TABLE "staff_profiles" ALTER COLUMN "social_category" SET DATA TYPE "SocialCategory" USING "social_category"::"SocialCategory";--> statement-breakpoint
ALTER TABLE "staff_qualifications" ALTER COLUMN "type" SET DATA TYPE "QualificationType" USING "type"::"QualificationType";--> statement-breakpoint
ALTER TABLE "student_academics" ALTER COLUMN "promotion_status" SET DATA TYPE "PromotionStatus" USING "promotion_status"::"PromotionStatus";--> statement-breakpoint
ALTER TABLE "student_guardian_links" ALTER COLUMN "relationship" SET DATA TYPE "GuardianRelationship" USING "relationship"::"GuardianRelationship";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "admission_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "admission_type" SET DATA TYPE "AdmissionType" USING "admission_type"::"AdmissionType";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "admission_type" SET DEFAULT 'NEW'::"AdmissionType";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "academic_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "academic_status" SET DATA TYPE "AcademicStatus" USING "academic_status"::"AcademicStatus";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "academic_status" SET DEFAULT 'ENROLLED'::"AcademicStatus";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "social_category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "social_category" SET DATA TYPE "SocialCategory" USING "social_category"::"SocialCategory";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "social_category" SET DEFAULT 'GENERAL'::"SocialCategory";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "minority_type" SET DATA TYPE "MinorityType" USING "minority_type"::"MinorityType";--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "stream" SET DATA TYPE "StudentStream" USING "stream"::"StudentStream";--> statement-breakpoint
ALTER TABLE "user_addresses" ALTER COLUMN "type" SET DATA TYPE "AddressType" USING "type"::"AddressType";--> statement-breakpoint
ALTER TABLE "user_documents" ALTER COLUMN "type" SET DATA TYPE "UserDocumentType" USING "type"::"UserDocumentType";--> statement-breakpoint
ALTER TABLE "user_identifiers" ALTER COLUMN "type" SET DATA TYPE "UserIdentifierType" USING "type"::"UserIdentifierType";--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "first_name" SET DATA TYPE jsonb USING "first_name"::jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "last_name" SET DATA TYPE jsonb USING "last_name"::jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "gender" SET DATA TYPE "Gender" USING "gender"::"Gender";--> statement-breakpoint
DROP INDEX "idx_identifiers_aadhaar_hash";--> statement-breakpoint
CREATE INDEX "idx_identifiers_aadhaar_hash" ON "user_identifiers" ("value_hash") WHERE type = 'AADHAAR';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enquiries_tenant_number" ON "enquiries" ("tenant_id","enquiry_number") WHERE "enquiry_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reseller_memberships_reseller_id_idx" ON "reseller_memberships" ("reseller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_tenant_label_key" ON "academic_years" ("tenant_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_entries_session_student_key" ON "attendance_entries" ("session_id","student_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "attendance_entries_tenant_id_idx" ON "attendance_entries" ("tenant_id");--> statement-breakpoint
CREATE INDEX "attendance_entries_session_id_idx" ON "attendance_entries" ("session_id");--> statement-breakpoint
CREATE INDEX "attendance_entries_student_id_idx" ON "attendance_entries" ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_entries_status_idx" ON "attendance_entries" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_sessions_section_date_period_key" ON "attendance_sessions" ("section_id","date","period") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "attendance_sessions_tenant_id_idx" ON "attendance_sessions" ("tenant_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_section_date_idx" ON "attendance_sessions" ("section_id","date");--> statement-breakpoint
CREATE INDEX "attendance_sessions_academic_year_id_idx" ON "attendance_sessions" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_date_idx" ON "attendance_sessions" ("date");--> statement-breakpoint
CREATE INDEX "holidays_tenant_id_idx" ON "holidays" ("tenant_id");--> statement-breakpoint
CREATE INDEX "holidays_start_date_idx" ON "holidays" ("start_date");--> statement-breakpoint
CREATE INDEX "holidays_type_idx" ON "holidays" ("type");--> statement-breakpoint
CREATE INDEX "holidays_range_idx" ON "holidays" ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "leaves_tenant_id_idx" ON "leaves" ("tenant_id");--> statement-breakpoint
CREATE INDEX "leaves_user_id_idx" ON "leaves" ("user_id");--> statement-breakpoint
CREATE INDEX "leaves_status_idx" ON "leaves" ("status");--> statement-breakpoint
CREATE INDEX "leaves_user_range_idx" ON "leaves" ("user_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_search" ON "user_profiles" USING gin (search_vector);--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_session_id_attendance_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_student_id_memberships_id_fkey" FOREIGN KEY ("student_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_subject_id_subjects_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_lecturer_id_memberships_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_memberships_id_fkey" FOREIGN KEY ("user_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_decided_by_memberships_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_label_format_check" CHECK ("label" ~ '^[0-9]{4}-[0-9]{2}$');--> statement-breakpoint
CREATE POLICY "attendance_entries_app_select" ON "attendance_entries" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_entries_app_insert" ON "attendance_entries" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_entries_app_update" ON "attendance_entries" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_entries_app_delete" ON "attendance_entries" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "attendance_entries_reseller_read" ON "attendance_entries" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "attendance_entries_admin_all" ON "attendance_entries" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "attendance_sessions_app_select" ON "attendance_sessions" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_sessions_app_insert" ON "attendance_sessions" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_sessions_app_update" ON "attendance_sessions" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "attendance_sessions_app_delete" ON "attendance_sessions" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "attendance_sessions_reseller_read" ON "attendance_sessions" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "attendance_sessions_admin_all" ON "attendance_sessions" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "holidays_app_select" ON "holidays" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "holidays_app_insert" ON "holidays" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "holidays_app_update" ON "holidays" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "holidays_app_delete" ON "holidays" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "holidays_reseller_read" ON "holidays" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "holidays_admin_all" ON "holidays" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "leaves_app_select" ON "leaves" AS PERMISSIVE FOR SELECT TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "leaves_app_insert" ON "leaves" AS PERMISSIVE FOR INSERT TO "roviq_app" WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "leaves_app_update" ON "leaves" AS PERMISSIVE FOR UPDATE TO "roviq_app" USING (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ) WITH CHECK (
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );--> statement-breakpoint
CREATE POLICY "leaves_app_delete" ON "leaves" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);--> statement-breakpoint
CREATE POLICY "leaves_reseller_read" ON "leaves" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ));--> statement-breakpoint
CREATE POLICY "leaves_admin_all" ON "leaves" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "plan_reseller_select" ON "plans" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "plan_reseller_insert" ON "plans" AS PERMISSIVE FOR INSERT TO "roviq_reseller" WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "plan_reseller_update" ON "plans" AS PERMISSIVE FOR UPDATE TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "plan_reseller_delete" ON "plans" AS PERMISSIVE FOR DELETE TO "roviq_reseller" USING (false);