-- ============================================
-- Enable RLS on all tenant-scoped tables
-- ============================================

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Refresh Tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- IMPORTANT: organizations table does NOT have RLS
-- Platform admin needs cross-tenant access to list/manage institutes
-- ============================================

-- ============================================
-- Grant roviq_admin BYPASSRLS for admin operations
-- (roviq_admin role created in docker-compose init-db.sh)
-- ============================================
ALTER ROLE roviq_admin BYPASSRLS;
