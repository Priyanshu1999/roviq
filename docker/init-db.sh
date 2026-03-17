#!/bin/bash
# Create application roles for Roviq.
# roviq       — bootstrap superuser (migrations only, NOT used at runtime)
# roviq_app   — application runtime (non-superuser, RLS enforced)
# roviq_admin — admin operations (non-superuser, policy-based RLS bypass)
# RLS bypass is policy-based (app.is_platform_admin), NOT role-level BYPASSRLS.

psql -U roviq -d roviq <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_app') THEN
    CREATE ROLE roviq_app WITH LOGIN PASSWORD 'roviq_app_dev';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN
    CREATE ROLE roviq_admin WITH LOGIN PASSWORD 'roviq_admin_dev';
  END IF;
END
$$;

-- Role inheritance: both roles get table permissions from roviq (the table owner)
GRANT roviq TO roviq_app;
GRANT roviq TO roviq_admin;
-- Allow roviq_app to SET ROLE roviq_admin (used by withAdmin() for admin operations)
GRANT roviq_admin TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_admin;
SQL

# Create the e2e test database (separate from dev to keep dev data safe)
psql -U roviq -d postgres <<'SQL'
SELECT 'CREATE DATABASE roviq_test OWNER roviq'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'roviq_test')\gexec
SQL

psql -U roviq -d roviq_test <<'SQL'
GRANT USAGE ON SCHEMA public TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_admin;
-- Grant default privileges so tables created by db:push (owned by roviq)
-- are automatically accessible to the app/admin roles
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO roviq_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE roviq IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO roviq_admin;
SQL
