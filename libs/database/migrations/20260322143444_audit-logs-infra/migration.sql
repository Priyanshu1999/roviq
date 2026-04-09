-- =============================================================
-- audit_logs infrastructure: partitioning, indexes, GRANTs, RLS
-- =============================================================
-- Drizzle creates audit_logs as a regular table. PostgreSQL does
-- not support ALTER TABLE ... SET PARTITION BY, so we rename the
-- original, create a partitioned replacement via LIKE INCLUDING
-- ALL, then drop the original. LIKE does NOT copy RLS policies,
-- so we re-create them explicitly below.
-- =============================================================

-- 1. Convert to partitioned table
ALTER TABLE audit_logs RENAME TO audit_logs_old;

CREATE TABLE audit_logs (LIKE audit_logs_old INCLUDING ALL)
  PARTITION BY RANGE (created_at);

-- 2. Create initial monthly partitions
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 3. Drop the original (policies were NOT copied by LIKE)
DROP TABLE audit_logs_old;

-- 3b. Re-add foreign keys. CREATE TABLE ... LIKE INCLUDING ALL copies
-- constraints EXCEPT foreign keys, so the partitioned replacement loses
-- them silently. Without these, invalid user_id values can be inserted —
-- see audit-security-invariants.spec.ts "Invariant 9".
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_tenant_id_institutes_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES institutes (id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_reseller_id_resellers_id_fkey
  FOREIGN KEY (reseller_id) REFERENCES resellers (id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_users_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_id_users_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users (id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_impersonator_id_users_id_fkey
  FOREIGN KEY (impersonator_id) REFERENCES users (id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_impersonation_session_id_fkey
  FOREIGN KEY (impersonation_session_id) REFERENCES impersonation_sessions (id);

-- 4. Re-create RLS policies (LIKE INCLUDING ALL does NOT copy policies)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- roviq_app: SELECT only institute-scoped rows for their tenant
CREATE POLICY audit_app_read ON audit_logs
  FOR SELECT TO roviq_app
  USING (
    scope = 'institute'
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- roviq_app: INSERT any row (scope enforcement via CHECK constraint)
CREATE POLICY audit_app_insert ON audit_logs
  FOR INSERT TO roviq_app
  WITH CHECK (true);

-- roviq_reseller: SELECT their institutes' rows + own reseller entries
CREATE POLICY audit_reseller_read ON audit_logs
  FOR SELECT TO roviq_reseller
  USING (
    (scope = 'institute' AND tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    ))
    OR
    (scope = 'reseller' AND reseller_id = current_setting('app.current_reseller_id', true)::uuid)
  );

-- roviq_reseller: INSERT any row
CREATE POLICY audit_reseller_insert ON audit_logs
  FOR INSERT TO roviq_reseller
  WITH CHECK (true);

-- roviq_admin: full access
CREATE POLICY audit_admin_all ON audit_logs
  FOR ALL TO roviq_admin
  USING (true)
  WITH CHECK (true);

-- 5. Indexes (7 total: 4 standard + 3 partial)
CREATE INDEX idx_audit_entity ON audit_logs (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs (tenant_id, user_id, created_at DESC);
CREATE INDEX idx_audit_action_type ON audit_logs (tenant_id, action_type, created_at DESC);
CREATE INDEX idx_audit_correlation ON audit_logs (correlation_id);
-- Partial indexes
CREATE INDEX idx_audit_impersonation ON audit_logs (tenant_id, impersonator_id)
  WHERE impersonator_id IS NOT NULL;
CREATE INDEX idx_audit_platform ON audit_logs (created_at DESC)
  WHERE scope = 'platform';
CREATE INDEX idx_audit_reseller ON audit_logs (reseller_id, created_at DESC)
  WHERE reseller_id IS NOT NULL;

-- 6. GRANTs — explicit permissions per role
GRANT SELECT, INSERT ON audit_logs TO roviq_app;
GRANT SELECT, INSERT ON audit_logs TO roviq_reseller;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO roviq_admin;

-- 7. REVOKE UPDATE/DELETE from non-admin roles (immutable for app/reseller)
REVOKE UPDATE, DELETE ON audit_logs FROM roviq_app;
REVOKE UPDATE, DELETE ON audit_logs FROM roviq_reseller;

-- 8. Sequence access for all roles
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;
