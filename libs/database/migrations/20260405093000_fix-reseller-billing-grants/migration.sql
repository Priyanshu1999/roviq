-- Fix: roviq_reseller needs write access to billing tables it manages
-- Previously only had SELECT — broke plan creation, subscription assignment,
-- invoice generation, and payment recording from reseller portal.
--
-- roviq_reseller manages: plans (full CRUD), subscriptions (create/update),
-- invoices (create/update), payments (create/update).
-- payment_gateway_configs already had correct GRANTs.
-- Guarded: only runs when EE billing tables exist (ROVIQ_EE=true environments).

DO $billing_reseller_grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plans') THEN
    RAISE NOTICE 'Skipping billing reseller grants — plans table not found (EE disabled)';
    RETURN;
  END IF;

  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON plans TO roviq_reseller';
  EXECUTE 'GRANT INSERT, UPDATE ON subscriptions TO roviq_reseller';
  EXECUTE 'GRANT INSERT, UPDATE ON invoices TO roviq_reseller';
  EXECUTE 'GRANT INSERT, UPDATE ON payments TO roviq_reseller';
END;
$billing_reseller_grants$;
