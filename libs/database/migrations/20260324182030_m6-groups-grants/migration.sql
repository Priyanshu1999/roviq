-- M6: Group tables — groups, group_rules, group_members, group_children
-- CREATE, RLS, FORCE, GRANTs

-- ── 1. groups ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "group_type" varchar(20) NOT NULL,
  "membership_type" varchar(10) NOT NULL DEFAULT 'dynamic',
  "member_types" text[] NOT NULL DEFAULT '{student}',
  "is_system" boolean NOT NULL DEFAULT false,
  "status" varchar(10) NOT NULL DEFAULT 'active',
  "resolved_at" timestamp with time zone,
  "member_count" integer DEFAULT 0,
  "parent_group_id" uuid,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
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

ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_group_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_group_name_active" ON "groups" ("tenant_id", "name") WHERE "deleted_at" IS NULL;

-- ── 2. group_rules ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "group_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "rule" jsonb NOT NULL,
  "rule_dimensions" text[] NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

-- ── 3. group_members ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "source" varchar(10) NOT NULL,
  "is_excluded" boolean NOT NULL DEFAULT false,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "chk_member_source" CHECK ("source" IN ('manual', 'rule', 'inherited'))
);

ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE cascade ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_member" ON "group_members" ("group_id", "membership_id");
CREATE INDEX IF NOT EXISTS "idx_group_members_group" ON "group_members" ("group_id") WHERE "is_excluded" = false;
CREATE INDEX IF NOT EXISTS "idx_group_members_membership" ON "group_members" ("membership_id");

-- ── 4. group_children ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "group_children" (
  "parent_group_id" uuid NOT NULL,
  "child_group_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  PRIMARY KEY ("parent_group_id", "child_group_id"),
  CONSTRAINT "chk_no_self_ref" CHECK ("parent_group_id" != "child_group_id")
);

ALTER TABLE "group_children" ADD CONSTRAINT "group_children_parent_group_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "group_children" ADD CONSTRAINT "group_children_child_group_id_fk" FOREIGN KEY ("child_group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "group_children" ADD CONSTRAINT "group_children_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "institutes"("id") ON DELETE restrict ON UPDATE cascade;

-- ── 5. ENABLE + FORCE ROW LEVEL SECURITY ──────────────────────
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "group_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_rules" FORCE ROW LEVEL SECURITY;
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" FORCE ROW LEVEL SECURITY;
ALTER TABLE "group_children" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_children" FORCE ROW LEVEL SECURITY;

-- ── 6. RLS Policies — groups (tenantPolicies: 7 policies with deleted_at) ──
CREATE POLICY "groups_app_select" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL);
CREATE POLICY "groups_app_select_trash" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NOT NULL AND current_setting('app.include_deleted', true) = 'true');
CREATE POLICY "groups_app_insert" ON "groups" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "groups_app_update" ON "groups" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "groups_app_delete" ON "groups" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "groups_reseller_read" ON "groups" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "groups_admin_all" ON "groups" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 7. RLS Policies — group_rules (tenantPoliciesSimple: 6 policies, no deleted_at) ──
CREATE POLICY "group_rules_app_select" ON "group_rules" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_rules_app_insert" ON "group_rules" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_rules_app_update" ON "group_rules" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_rules_app_delete" ON "group_rules" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "group_rules_reseller_read" ON "group_rules" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "group_rules_admin_all" ON "group_rules" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 8. RLS Policies — group_members (tenantPoliciesSimple: 6 policies, no deleted_at) ──
CREATE POLICY "group_members_app_select" ON "group_members" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_members_app_insert" ON "group_members" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_members_app_update" ON "group_members" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_members_app_delete" ON "group_members" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "group_members_reseller_read" ON "group_members" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "group_members_admin_all" ON "group_members" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 9. RLS Policies — group_children (tenantPoliciesSimple: 6 policies, no deleted_at) ──
CREATE POLICY "group_children_app_select" ON "group_children" AS PERMISSIVE FOR SELECT TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_children_app_insert" ON "group_children" AS PERMISSIVE FOR INSERT TO "roviq_app"
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_children_app_update" ON "group_children" AS PERMISSIVE FOR UPDATE TO "roviq_app"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "group_children_app_delete" ON "group_children" AS PERMISSIVE FOR DELETE TO "roviq_app" USING (false);
CREATE POLICY "group_children_reseller_read" ON "group_children" AS PERMISSIVE FOR SELECT TO "roviq_reseller"
  USING (tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid));
CREATE POLICY "group_children_admin_all" ON "group_children" AS PERMISSIVE FOR ALL TO "roviq_admin" USING (true) WITH CHECK (true);

-- ── 10. GRANTs ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON groups TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON group_rules TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON group_members TO roviq_app;
GRANT SELECT, INSERT, UPDATE ON group_children TO roviq_app;

GRANT SELECT ON groups TO roviq_reseller;
GRANT SELECT ON group_rules TO roviq_reseller;
GRANT SELECT ON group_members TO roviq_reseller;
GRANT SELECT ON group_children TO roviq_reseller;

GRANT SELECT, INSERT, UPDATE, DELETE ON groups TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_rules TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_members TO roviq_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_children TO roviq_admin;
