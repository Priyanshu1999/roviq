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

-- Default-DENY enforcement for `_live` views. Without `security_invoker =
-- true`, SELECT on a view runs as the view OWNER (migrate superuser) and
-- silently bypasses RLS — cross-tenant rows leak. This DDL trigger fires
-- after every CREATE VIEW / ALTER VIEW and forces the bit on any view
-- ending in `_live`. Installed before any view exists, so it covers
-- every view ever created in this DB.

CREATE OR REPLACE FUNCTION enforce_live_view_security_invoker()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  obj record;
  view_oid oid;
  current_options text[];
  view_name text;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'view' AND schema_name = 'public'
  LOOP
    view_name := btrim(split_part(obj.object_identity, '.', 2), '"');
    IF view_name NOT LIKE '%\_live' ESCAPE '\' THEN
      CONTINUE;
    END IF;

    SELECT c.oid, c.reloptions INTO view_oid, current_options
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = obj.schema_name AND c.relname = view_name AND c.relkind = 'v';

    IF view_oid IS NULL THEN
      CONTINUE;
    END IF;

    -- Already secured — skip the ALTER to avoid infinite re-entry (ALTER
    -- VIEW also fires this trigger).
    IF current_options IS NOT NULL
       AND 'security_invoker=true' = ANY(current_options) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)',
                   obj.schema_name, view_name);
    EXECUTE format('GRANT SELECT ON %I.%I TO roviq_app, roviq_reseller, roviq_admin',
                   obj.schema_name, view_name);
  END LOOP;
END
$$;

DROP EVENT TRIGGER IF EXISTS enforce_live_view_security_invoker;
CREATE EVENT TRIGGER enforce_live_view_security_invoker
  ON ddl_command_end
  WHEN TAG IN ('CREATE VIEW', 'ALTER VIEW')
  EXECUTE FUNCTION enforce_live_view_security_invoker();
