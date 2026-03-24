-- M1: User profile platform tables — CREATE + GRANTs + extensions (ROV-151)
-- These tables have NO RLS. Access controlled by PostgreSQL role GRANTs + application-level CASL.

-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. user_profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
  "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name, '')), 'B')
  ) STORED,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  CONSTRAINT "chk_gender" CHECK ("gender" IN ('male', 'female', 'other')),
  CONSTRAINT "chk_blood_group" CHECK ("blood_group" IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'))
);

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "user_profiles" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_profiles_search" ON "user_profiles" USING gin ("search_vector");

-- ── 2. user_identifiers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(30) NOT NULL,
  "value_encrypted" bytea,
  "value_hash" varchar(64),
  "value_plain" varchar(50),
  "value_masked" varchar(20),
  "issuing_authority" varchar(100),
  "valid_from" date,
  "valid_to" date,
  "is_verified" boolean DEFAULT false NOT NULL,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_identifier_value" CHECK (
    (
      "value_encrypted" IS NOT NULL
      AND "value_hash" IS NOT NULL
      AND "value_masked" IS NOT NULL
    ) OR "value_plain" IS NOT NULL
  ),
  CONSTRAINT "chk_identifier_type" CHECK (
    "type" IN (
      'aadhaar', 'pan', 'passport', 'voter_id',
      'apaar', 'pen', 'cbse_registration', 'bseh_enrollment',
      'shala_darpan_id', 'parivar_pehchan_patra', 'jan_aadhaar',
      'migration_certificate'
    )
  )
);

ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_identifier_user_type" ON "user_identifiers" USING btree ("user_id", "type");
CREATE INDEX IF NOT EXISTS "idx_identifiers_aadhaar_hash" ON "user_identifiers" USING btree ("value_hash") WHERE type = 'aadhaar';
CREATE INDEX IF NOT EXISTS "idx_user_identifiers_user_id" ON "user_identifiers" USING btree ("user_id");

-- ── 3. user_documents ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
  CONSTRAINT "chk_document_type" CHECK (
    "type" IN (
      'birth_certificate', 'tc_incoming', 'report_card', 'aadhaar_card',
      'caste_certificate', 'income_certificate', 'ews_certificate',
      'medical_certificate', 'disability_certificate', 'address_proof',
      'passport_photo', 'family_photo', 'bpl_card', 'transfer_order',
      'noc', 'affidavit', 'other'
    )
  )
);

ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_user_documents_user_type" ON "user_documents" USING btree ("user_id", "type");

-- ── 4. user_addresses ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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

ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_address_user_type" ON "user_addresses" USING btree ("user_id", "type");
CREATE INDEX IF NOT EXISTS "idx_user_addresses_user_id" ON "user_addresses" USING btree ("user_id");

-- ── GRANTs ──────────────────────────────────────────────────────
-- roviq_app: read + write (CASL enforces who can actually write)
GRANT SELECT, INSERT, UPDATE ON user_profiles TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON user_identifiers TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON user_documents TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON user_addresses TO roviq_app;

-- roviq_reseller: read-only
GRANT SELECT ON user_profiles TO roviq_reseller;
GRANT SELECT ON user_identifiers TO roviq_reseller;
GRANT SELECT ON user_documents TO roviq_reseller;
GRANT SELECT ON user_addresses TO roviq_reseller;

-- roviq_admin: full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_identifiers TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_documents TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_addresses TO roviq_admin;
