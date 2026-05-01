-- Runtime prereqs: DB roles, extensions, and SQL helpers that subsequent
-- migrations reference. Authored as the first migration so `drizzle-kit
-- migrate` can build a DB from scratch — db-reset.ts does the same setup
-- pre-push for dev resets.

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_app') THEN CREATE ROLE roviq_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_reseller') THEN CREATE ROLE roviq_reseller NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN CREATE ROLE roviq_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_pooler') THEN CREATE ROLE roviq_pooler WITH LOGIN PASSWORD 'roviq_pooler_dev' NOINHERIT; END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Wraps `SELECT … FROM jsonb_each_text(val)` in an IMMUTABLE function so it
-- can be referenced from `GENERATED ALWAYS AS` expressions (PG 18 forbids
-- subqueries there). Used by user_profiles.search_vector.
CREATE OR REPLACE FUNCTION i18n_text_to_string(val jsonb)
RETURNS text
IMMUTABLE
LANGUAGE sql
AS $$
  SELECT string_agg(value, ' ') FROM jsonb_each_text(val);
$$;
