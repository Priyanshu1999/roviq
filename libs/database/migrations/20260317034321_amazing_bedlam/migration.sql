CREATE TYPE "EducationLevel" AS ENUM('PRE_PRIMARY', 'PRIMARY', 'UPPER_PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY');--> statement-breakpoint
CREATE TYPE "NepStage" AS ENUM('FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY');--> statement-breakpoint
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
CREATE UNIQUE INDEX "standards_tenant_year_name_key" ON "standards" ("tenant_id","academic_year_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "standards_tenant_year_order_key" ON "standards" ("tenant_id","academic_year_id","numeric_order") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "standards_tenant_id_idx" ON "standards" ("tenant_id");--> statement-breakpoint
CREATE INDEX "standards_academic_year_id_idx" ON "standards" ("academic_year_id");--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_tenant_id_institutes_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
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
CREATE POLICY "standards_admin_all" ON "standards" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);