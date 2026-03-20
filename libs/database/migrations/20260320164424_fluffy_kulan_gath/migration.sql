-- ROV-87: Create resellers table + add reseller_id to institutes

-- Ensure roviq_reseller role exists (created properly in ROV-89, but needed for policies here)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_reseller') THEN
    CREATE ROLE roviq_reseller NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
CREATE TYPE "ResellerStatus" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "reseller_tier" AS ENUM('full_management', 'support_management', 'read_only');--> statement-breakpoint
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
ALTER TABLE "resellers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Seed default system reseller before FK is added to institutes
INSERT INTO resellers (id, name, slug, is_system, tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'Roviq Direct', 'roviq-direct', true, 'full_management')
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "reseller_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resellers_slug_key" ON "resellers" ("slug");--> statement-breakpoint
CREATE INDEX "institutes_reseller_id_idx" ON "institutes" ("reseller_id");--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_reseller_id_resellers_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id");--> statement-breakpoint
CREATE POLICY "reseller_own_read" ON "resellers" AS PERMISSIVE FOR SELECT TO "roviq_reseller" USING (id = current_setting('app.current_reseller_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "reseller_admin_all" ON "resellers" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
-- Grant permissions for new table
GRANT SELECT, INSERT, UPDATE, DELETE ON resellers TO roviq_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON resellers TO roviq_admin;
