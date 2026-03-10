-- Fix tenant_isolation RLS policies: wrap current_setting with NULLIF before ::uuid cast.
-- Without NULLIF, an empty string (when app.current_tenant_id is not set) causes
-- "invalid input syntax for type uuid" — breaking admin client queries even though
-- the admin_platform_access policy would grant access (PostgreSQL evaluates all
-- permissive policy expressions, it does NOT short-circuit on first match).

-- roles
DROP POLICY tenant_isolation_roles ON roles;
CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- memberships
DROP POLICY tenant_isolation_memberships ON memberships;
CREATE POLICY tenant_isolation_memberships ON memberships
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- refresh_tokens
DROP POLICY tenant_isolation_refresh_tokens ON refresh_tokens;
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- profiles
DROP POLICY tenant_isolation_profiles ON profiles;
CREATE POLICY tenant_isolation_profiles ON profiles
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- student_guardians
DROP POLICY tenant_isolation_student_guardians ON student_guardians;
CREATE POLICY tenant_isolation_student_guardians ON student_guardians
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
