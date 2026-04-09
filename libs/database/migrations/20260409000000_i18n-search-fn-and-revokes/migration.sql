-- Custom migration: i18n_text_to_string helper + targeted REVOKEs
--
-- 1. `i18n_text_to_string(jsonb)` is an IMMUTABLE SQL function that flattens
--    an i18nText jsonb map (`{ en: "Raj", hi: "राज" }`) into a space-separated
--    string of its values. Required by `user_profiles.search_vector` —
--    PostgreSQL 18 forbids subqueries inside `GENERATED ALWAYS AS`
--    expressions, so the original `SELECT ... FROM jsonb_each_text(val)`
--    form is invalid. Wrapping the subquery inside an IMMUTABLE function
--    works because function calls are not themselves subqueries.
--
-- 2. The REVOKEs below tighten the broad `GRANT ... ON ALL TABLES TO
--    roviq_app` issued by `db-reset.ts` step 5. They are NOT in any prior
--    migration:
--      - institutes: roviq_app reads its own institute, never writes
--      - auth_events: admin-only readable (roviq_app can INSERT only)
--      - billing tables: roviq_app gets SELECT only
--    Without these, after `pnpm db:reset` the tenant-runtime role would
--    inherit full CRUD on tables it should never modify.

CREATE OR REPLACE FUNCTION i18n_text_to_string(val jsonb)
RETURNS text
IMMUTABLE
LANGUAGE sql
AS $$
  SELECT string_agg(value, ' ') FROM jsonb_each_text(val);
$$;
--> statement-breakpoint

REVOKE INSERT, UPDATE, DELETE ON institutes FROM roviq_app;
--> statement-breakpoint

REVOKE SELECT ON auth_events FROM roviq_app;
--> statement-breakpoint

REVOKE INSERT, UPDATE, DELETE ON plans, subscriptions, invoices, payments FROM roviq_app;
