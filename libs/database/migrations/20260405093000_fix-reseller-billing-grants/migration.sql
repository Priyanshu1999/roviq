-- Fix: roviq_reseller needs write access to billing tables it manages
-- Previously only had SELECT — broke plan creation, subscription assignment,
-- invoice generation, and payment recording from reseller portal.
--
-- roviq_reseller manages: plans (full CRUD), subscriptions (create/update),
-- invoices (create/update), payments (create/update).
-- payment_gateway_configs already had correct GRANTs.

GRANT INSERT, UPDATE, DELETE ON plans TO roviq_reseller;
GRANT INSERT, UPDATE ON subscriptions TO roviq_reseller;
GRANT INSERT, UPDATE ON invoices TO roviq_reseller;
GRANT INSERT, UPDATE ON payments TO roviq_reseller;
