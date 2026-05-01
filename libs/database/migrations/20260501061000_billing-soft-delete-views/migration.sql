-- Move billing soft-delete visibility from RLS to *_live security_invoker
-- views, matching the convention every other soft-deletable table follows.
-- Without this, soft-delete UPDATEs on plans/payment_gateway_configs fail
-- because PG re-applies SELECT policies to the post-update row (the
-- "can't UPDATE a row into invisibility" rule) and the legacy policies
-- filter `deleted_at IS NULL`.

-- 1. Drop legacy policies that filter on deleted_at.
DROP POLICY IF EXISTS plan_reseller_select ON plans;
DROP POLICY IF EXISTS plan_reseller_trash ON plans;
DROP POLICY IF EXISTS plan_app_read ON plans;
DROP POLICY IF EXISTS gwc_reseller_all ON payment_gateway_configs;

-- 2. Recreate without the deleted_at filter — soft-delete visibility moves
--    to the *_live views below.
CREATE POLICY plan_reseller_select ON plans
  FOR SELECT TO roviq_reseller
  USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid);

CREATE POLICY plan_app_read ON plans
  FOR SELECT TO roviq_app
  USING (
    id IN (
      SELECT plan_id FROM subscriptions
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

CREATE POLICY gwc_reseller_all ON payment_gateway_configs
  FOR ALL TO roviq_reseller
  USING (reseller_id = current_setting('app.current_reseller_id', true)::uuid)
  WITH CHECK (reseller_id = current_setting('app.current_reseller_id', true)::uuid);

-- 3. Create the live views. security_invoker=true so SELECT runs RLS as the
--    calling DB role, not the view owner — without it, an roviq_app
--    connection could read other tenants' rows through the view.
CREATE OR REPLACE VIEW plans_live
  WITH (security_invoker = true) AS
  SELECT * FROM plans WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW payment_gateway_configs_live
  WITH (security_invoker = true) AS
  SELECT * FROM payment_gateway_configs WHERE deleted_at IS NULL;

GRANT SELECT ON plans_live TO roviq_app, roviq_reseller, roviq_admin;
GRANT SELECT ON payment_gateway_configs_live TO roviq_reseller, roviq_admin;
