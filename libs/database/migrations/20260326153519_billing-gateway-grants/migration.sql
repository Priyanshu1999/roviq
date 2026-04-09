-- GRANTs for payment_gateway_configs (missing from billing schema migration)
-- roviq_reseller needs full CRUD (owns gateway configs), roviq_admin full access.
-- roviq_app gets NO access — payment processing flows through withReseller(),
-- not withTenant(), so the app role must not read gateway credentials.
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_admin;
REVOKE ALL ON payment_gateway_configs FROM roviq_app;
