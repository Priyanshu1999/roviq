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
GRANT USAGE ON SCHEMA public TO roviq_app;
GRANT USAGE ON SCHEMA public TO roviq_admin;
SQL
