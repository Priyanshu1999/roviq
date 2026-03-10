-- ============================================
-- Replace role-level BYPASSRLS with policy-based admin bypass.
-- Admin client sets app.is_platform_admin = 'true' before queries.
-- ============================================

-- Remove BYPASSRLS from roviq_admin
ALTER ROLE roviq_admin NOBYPASSRLS;

-- Add admin bypass policy to each tenant-scoped table.
-- These allow the admin client to access all rows when app.is_platform_admin is set.

CREATE POLICY admin_platform_access_roles ON roles
  USING (current_setting('app.is_platform_admin', true) = 'true');

CREATE POLICY admin_platform_access_memberships ON memberships
  USING (current_setting('app.is_platform_admin', true) = 'true');

CREATE POLICY admin_platform_access_refresh_tokens ON refresh_tokens
  USING (current_setting('app.is_platform_admin', true) = 'true');

CREATE POLICY admin_platform_access_profiles ON profiles
  USING (current_setting('app.is_platform_admin', true) = 'true');

CREATE POLICY admin_platform_access_student_guardians ON student_guardians
  USING (current_setting('app.is_platform_admin', true) = 'true');
