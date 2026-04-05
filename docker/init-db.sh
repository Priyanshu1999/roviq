#!/bin/bash
# Create application roles for Roviq (four-role model, Auth PRD v3.0).
#
# roviq          — bootstrap superuser (migrations only, NOT used at runtime)
# roviq_pooler   — NOINHERIT login role (connection pool), assumes app roles via SET LOCAL ROLE
# roviq_app      — institute-scoped operations (NOLOGIN, RLS via app.current_tenant_id)
# roviq_reseller — reseller-scoped operations (NOLOGIN, RLS via app.current_reseller_id)
# roviq_admin    — platform admin operations (NOLOGIN, full access via policies)
#
# IMPORTANT: Do NOT grant roviq role membership to any app role.
# Role inheritance from the table owner (roviq) causes PostgreSQL to treat the
# member as the owner for RLS purposes (via has_privs_of_role), bypassing RLS
# entirely. Use explicit privilege grants instead.

psql -U roviq -d roviq <<'SQL'
DO $$
BEGIN
  -- App roles (NOLOGIN — assumed via SET LOCAL ROLE)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_app') THEN
    CREATE ROLE roviq_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_reseller') THEN
    CREATE ROLE roviq_reseller NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN
    CREATE ROLE roviq_admin NOLOGIN;
  END IF;

  -- Pool role (LOGIN, NOINHERIT — must SET LOCAL ROLE to get any privileges)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_pooler') THEN
    CREATE ROLE roviq_pooler WITH LOGIN PASSWORD 'roviq_pooler_dev' NOINHERIT;
  END IF;
END
$$;

-- Migrate existing roles to NOLOGIN if they were created with LOGIN previously
ALTER ROLE roviq_app NOLOGIN;
ALTER ROLE roviq_reseller NOLOGIN;
ALTER ROLE roviq_admin NOLOGIN;
ALTER ROLE roviq_pooler LOGIN NOINHERIT;

-- Revoke any stale role inheritance from previous init-db versions.
REVOKE roviq FROM roviq_app;
REVOKE roviq FROM roviq_admin;
REVOKE roviq FROM roviq_pooler;

-- Pool role can assume all three app roles via SET LOCAL ROLE
GRANT roviq_app TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
GRANT roviq_reseller TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
GRANT roviq_admin TO roviq_pooler WITH INHERIT FALSE, SET TRUE;

-- Schema access
GRANT USAGE ON SCHEMA public TO roviq_pooler;
GRANT USAGE ON SCHEMA public TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_reseller;
GRANT USAGE ON SCHEMA public TO roviq_admin;

-- ── Per-role DML privileges ─────────────────────────────────────────────
-- roviq_app: CRUD on tenant tables, SELECT on shared tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_app;

-- roviq_reseller: SELECT on tenant tables, CRUD on reseller tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE ON impersonation_sessions TO roviq_reseller;
GRANT INSERT, UPDATE ON institutes TO roviq_reseller;
GRANT INSERT, UPDATE, DELETE ON plans TO roviq_reseller;
GRANT INSERT, UPDATE ON subscriptions TO roviq_reseller;
GRANT INSERT, UPDATE ON invoices TO roviq_reseller;
GRANT INSERT, UPDATE ON payments TO roviq_reseller;
GRANT INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_reseller;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;

-- roviq_admin: full access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;

-- ── Default privileges for future tables (created by db:push as roviq) ──
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT ON TABLES TO roviq_reseller;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_reseller;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_admin;
SQL

# Create the e2e test database (separate from dev to keep dev data safe)
psql -U roviq -d postgres <<'SQL'
SELECT 'CREATE DATABASE roviq_test OWNER roviq'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'roviq_test')\gexec
SQL

psql -U roviq -d roviq_test <<'SQL'
-- Revoke stale role inheritance
REVOKE roviq FROM roviq_app;
REVOKE roviq FROM roviq_admin;
REVOKE roviq FROM roviq_pooler;

-- Pool role can assume all three app roles
GRANT roviq_app TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
GRANT roviq_reseller TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
GRANT roviq_admin TO roviq_pooler WITH INHERIT FALSE, SET TRUE;

-- Schema access
GRANT USAGE ON SCHEMA public TO roviq_pooler;
GRANT USAGE ON SCHEMA public TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_reseller;
GRANT USAGE ON SCHEMA public TO roviq_admin;

-- DML privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE ON impersonation_sessions TO roviq_reseller;
GRANT INSERT, UPDATE ON institutes TO roviq_reseller;
GRANT INSERT, UPDATE, DELETE ON plans TO roviq_reseller;
GRANT INSERT, UPDATE ON subscriptions TO roviq_reseller;
GRANT INSERT, UPDATE ON invoices TO roviq_reseller;
GRANT INSERT, UPDATE ON payments TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT ON TABLES TO roviq_reseller;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_reseller;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_admin;
SQL
