-- Backfill memberships from existing users
INSERT INTO memberships (id, user_id, tenant_id, role_id, abilities, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  id,
  tenant_id,
  role_id,
  COALESCE(abilities, '[]'::jsonb),
  is_active,
  created_at,
  updated_at
FROM users;

-- Backfill auth_providers for existing password-based users
INSERT INTO auth_providers (id, user_id, provider, created_at, updated_at)
SELECT
  gen_random_uuid(),
  id,
  'password',
  created_at,
  updated_at
FROM users;
