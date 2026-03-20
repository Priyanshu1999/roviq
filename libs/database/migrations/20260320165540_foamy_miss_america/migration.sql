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
ALTER TABLE "platform_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "reseller_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_membership_user" ON "platform_memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reseller_membership" ON "reseller_memberships" ("user_id","reseller_id");--> statement-breakpoint
ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "reseller_memberships" ADD CONSTRAINT "reseller_memberships_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
CREATE POLICY "platform_membership_admin" ON "platform_memberships" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "reseller_membership_own" ON "reseller_memberships" AS PERMISSIVE FOR ALL TO "roviq_reseller" USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid) WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "reseller_membership_admin" ON "reseller_memberships" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "membership_reseller_read" ON "memberships" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (tenant_id IN (
        SELECT id FROM institutes
        WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
      ));--> statement-breakpoint
-- Grants for new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_memberships TO roviq_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_memberships TO roviq_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;