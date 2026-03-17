CREATE TYPE "BatchStatus" AS ENUM('UPCOMING', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "GenderRestriction" AS ENUM('CO_ED', 'BOYS_ONLY', 'GIRLS_ONLY');--> statement-breakpoint
CREATE TYPE "StreamType" AS ENUM('SCIENCE', 'COMMERCE', 'ARTS');--> statement-breakpoint
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
CREATE UNIQUE INDEX "sections_standard_name_key" ON "sections" ("standard_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sections_tenant_id_idx" ON "sections" ("tenant_id");--> statement-breakpoint
CREATE INDEX "sections_standard_id_idx" ON "sections" ("standard_id");--> statement-breakpoint
CREATE INDEX "sections_academic_year_id_idx" ON "sections" ("academic_year_id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_standard_id_standards_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_memberships_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
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
CREATE POLICY "sections_admin_all" ON "sections" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);