#!/bin/bash
# Create roviq_admin role for platform-level operations (auth, cross-tenant admin queries).
# roviq_admin inherits table permissions from roviq via role membership.
# RLS bypass is policy-based (app.is_platform_admin), NOT role-level BYPASSRLS.

psql -U roviq -d roviq <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN
    CREATE ROLE roviq_admin WITH LOGIN PASSWORD 'roviq_admin_dev';
  END IF;
END
$$;

-- Role inheritance: roviq_admin gets all table permissions from roviq (the table owner)
GRANT roviq TO roviq_admin;
GRANT USAGE ON SCHEMA public TO roviq_admin;
SQL
