-- GRANTs for payment_gateway_configs (missing from billing schema migration)
-- roviq_reseller needs full CRUD (owns gateway configs), roviq_admin full access
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_gateway_configs TO roviq_admin;
-- roviq_app needs read for payment processing
GRANT SELECT ON payment_gateway_configs TO roviq_app;
