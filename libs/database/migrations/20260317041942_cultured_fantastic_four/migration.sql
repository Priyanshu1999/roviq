CREATE TYPE "GroupStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "GroupType" AS ENUM('TRUST', 'SOCIETY', 'CHAIN', 'FRANCHISE');--> statement-breakpoint
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
ALTER TABLE "institutes" ADD COLUMN "group_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_user_group_key" ON "group_memberships" ("user_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_group_branding_group_id_key" ON "institute_group_branding" ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_groups_code_key" ON "institute_groups" ("code") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "institutes_group_id_idx" ON "institutes" ("group_id");--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_institute_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "institute_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_group_branding" ADD CONSTRAINT "institute_group_branding_group_id_institute_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "institute_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "institute_groups" ADD CONSTRAINT "institute_groups_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
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
CREATE POLICY "institute_groups_admin_all" ON "institute_groups" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);