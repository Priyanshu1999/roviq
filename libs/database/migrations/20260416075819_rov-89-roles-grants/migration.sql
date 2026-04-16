-- =============================================================
-- ROV-89: Create roviq_pooler + roviq_reseller roles and apply
-- all GRANTs for the four-role model (Auth PRD v3.1 §2, §3, §9.1)
-- =============================================================
-- Creates database roles idempotently. The four-role model:
--   roviq          — superuser, migrations only (pre-existing)
--   roviq_pooler   — LOGIN, NOINHERIT. Connection pool role.
--                    Has NO direct privileges. Assumes app roles
--                    via SET LOCAL ROLE inside wrappers.
--   roviq_app      — NOLOGIN. Institute-scoped operations.
--                    RLS enforced via app.current_tenant_id.
--   roviq_reseller — NOLOGIN. Reseller-scoped operations.
--                    RLS enforced via app.current_reseller_id.
--   roviq_admin    — NOLOGIN. Platform-scoped operations.
--                    RLS via explicit permissive policies (no BYPASSRLS).
--
-- Safety: roviq_pooler has NOINHERIT. Without SET LOCAL ROLE, any
-- query fails with "permission denied" — safe failure mode.
-- =============================================================

-- 1. Create roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_app') THEN
    CREATE ROLE roviq_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_reseller') THEN
    CREATE ROLE roviq_reseller NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN
    CREATE ROLE roviq_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_pooler') THEN
    CREATE ROLE roviq_pooler WITH LOGIN PASSWORD 'roviq_pooler_dev' NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint

-- Ensure correct role properties (idempotent: roles may pre-exist from init-db.sh)
ALTER ROLE roviq_app NOLOGIN;
--> statement-breakpoint
ALTER ROLE roviq_reseller NOLOGIN;
--> statement-breakpoint
ALTER ROLE roviq_admin NOLOGIN;
--> statement-breakpoint
ALTER ROLE roviq_pooler LOGIN NOINHERIT;
--> statement-breakpoint

-- 2. Revoke stale role inheritance (prevent owner-bypass of RLS)
--    roviq superuser must NOT be a member of app roles — membership
--    causes PostgreSQL to treat the grantee as the table owner for
--    RLS purposes (via has_privs_of_role), silently bypassing all policies.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_auth_members WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = 'roviq_app')
             AND member = (SELECT oid FROM pg_roles WHERE rolname = 'roviq_pooler')
             AND admin_option = false AND inherit_option = true) THEN
    REVOKE roviq_app FROM roviq_pooler;
  END IF;
END
$$;
--> statement-breakpoint

-- 3. Grant pool role ability to assume each application role via SET LOCAL ROLE
--    WITH INHERIT FALSE: pooler does NOT inherit privileges directly (NOINHERIT).
--    WITH SET TRUE: pooler CAN use SET ROLE to assume the role.
GRANT roviq_app TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
--> statement-breakpoint
GRANT roviq_reseller TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
--> statement-breakpoint
GRANT roviq_admin TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
--> statement-breakpoint

-- 4. Schema access
GRANT USAGE ON SCHEMA public TO roviq_pooler;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO roviq_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO roviq_reseller;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO roviq_admin;
--> statement-breakpoint

-- 5. GRANTs per PRD §9.1
--
-- roviq_app: CRUD on institute-scoped tables (RLS limits to their tenant).
-- Note: institutes is SELECT-only for roviq_app (read own institute).
-- The broad GRANT is fine because RLS policies enforce row-level isolation.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  memberships,
  roles,
  academic_years,
  standards,
  sections,
  subjects,
  standard_subjects,
  section_subjects
TO roviq_app;
--> statement-breakpoint

-- roviq_app: SELECT on shared platform tables
GRANT SELECT ON users TO roviq_app;
--> statement-breakpoint
GRANT SELECT ON institutes TO roviq_app;
--> statement-breakpoint

-- roviq_reseller: SELECT on all institute data (RLS filters to their institutes)
GRANT SELECT ON
  memberships,
  roles,
  academic_years,
  standards,
  sections,
  subjects,
  standard_subjects,
  section_subjects,
  institutes,
  users
TO roviq_reseller;
--> statement-breakpoint

-- roviq_reseller: CRUD on reseller membership tables
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;
--> statement-breakpoint

-- roviq_reseller: SELECT on own reseller record
GRANT SELECT ON resellers TO roviq_reseller;
--> statement-breakpoint

-- roviq_reseller: manage impersonation sessions
GRANT SELECT, INSERT, UPDATE ON impersonation_sessions TO roviq_reseller;
--> statement-breakpoint

-- roviq_admin: full access on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;
--> statement-breakpoint

-- 6. Sequence access for all roles
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;
--> statement-breakpoint

-- 7. Default privileges for future tables (created by drizzle-kit migrations as roviq)
--    Ensures new tables created in future migrations automatically get the right permissions.
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT ON TABLES TO roviq_reseller;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_admin;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_reseller;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_admin;
--> statement-breakpoint

-- 8. Tighten overly-broad grants from previous migrations / init-db.sh.
--    REVOKE institutes write from roviq_app: already done in
--    20260409000000_i18n-search-fn-and-revokes, repeated here for clarity
--    (idempotent — no-op if already revoked).
REVOKE INSERT, UPDATE, DELETE ON institutes FROM roviq_app;
--> statement-breakpoint

-- roviq_reseller must NOT write to tenant data tables (SELECT only).
REVOKE INSERT, UPDATE, DELETE ON
  memberships,
  roles,
  academic_years,
  standards,
  sections,
  subjects,
  standard_subjects,
  section_subjects
FROM roviq_reseller;
