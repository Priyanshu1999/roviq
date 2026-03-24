-- M0: Prerequisite Schema Fixes (ROV-148, ROV-149, ROV-150)
-- =========================================================

-- ROV-149: Drop student_guardians (depends on profiles, must go first)
--> statement-breakpoint
DROP TABLE IF EXISTS "student_guardians" CASCADE;

-- ROV-149: Drop generic profiles table (superseded by domain-specific tables)
--> statement-breakpoint
DROP TABLE IF EXISTS "profiles" CASCADE;

-- ROV-148: Widen memberships unique constraint to allow dual-role memberships
-- A parent who is also a teacher needs two memberships at the same institute.
--> statement-breakpoint
DROP INDEX IF EXISTS "memberships_user_id_tenant_id_key";
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_role_id_key" ON "memberships" USING btree ("user_id" ASC NULLS LAST, "tenant_id" ASC NULLS LAST, "role_id" ASC NULLS LAST);

-- ROV-150: Partial unique index — exactly one primary phone per user
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_phone_numbers_primary" ON "phone_numbers" ("user_id") WHERE "is_primary" = true;

-- ROV-150: Add admission_number_config JSONB to institute_configs
--> statement-breakpoint
ALTER TABLE "institute_configs" ADD COLUMN "admission_number_config" jsonb DEFAULT '{"format":"{prefix}{year}/{value:04d}","year_format":"YYYY","prefixes":{"-3":"N-","-2":"L-","-1":"U-","1":"A-"},"no_prefix_from_class":2}';
