-- GRANTs for payment_gateway_configs (missing from billing schema migration)
-- roviq_reseller needs full CRUD (owns gateway configs), roviq_admin full access.
-- roviq_app gets NO access — payment processing flows through withReseller(),
-- not withTenant(), so the app role must not read gateway credentials.
-- Guarded: only runs when EE billing tables exist (ROVIQ_EE=true environments).

DO $billing_gw_grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_gateway_configs') THEN
    RAISE NOTICE 'Skipping billing gateway grants — payment_gateway_configs not found (EE disabled)';
    RETURN;
  END IF;

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_reseller';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_admin';
  EXECUTE 'REVOKE ALL ON payment_gateway_configs FROM roviq_app';
END;
$billing_gw_grants$;
