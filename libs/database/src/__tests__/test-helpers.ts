/**
 * Shared helpers for RLS integration tests.
 *
 * All tests use pg.Pool connected as superuser (roviq). These helpers
 * create test-specific users, memberships, and profiles that don't
 * collide with seed data.
 */
import type pg from 'pg';
import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Test Database URLs
// ---------------------------------------------------------------------------

/** roviq_pooler connection (same as production runtime — NOINHERIT, no direct privileges) */
export const TEST_POOLER_URL =
  process.env['DATABASE_URL_TEST'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5432/roviq';

/** Superuser connection for seeding test data (bypasses all RLS) */
export const TEST_SUPERUSER_URL =
  process.env['DATABASE_URL_TEST_MIGRATE'] ??
  process.env['DATABASE_URL_MIGRATE'] ??
  'postgresql://roviq:roviq_dev@localhost:5432/roviq';

/** Create a test user in the `users` table. Returns the user ID. */
export async function createTestUser(client: pg.PoolClient, id: string): Promise<string> {
  await client.query(
    `INSERT INTO users (id, username, email, password_hash)
     VALUES ($1, $2, $3, 'not-a-real-hash')`,
    [id, `testuser-${id.slice(-8)}`, `test-${id.slice(-8)}@test.local`],
  );
  return id;
}

/** Find the first role for an institute. */
export async function findRole(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query(`SELECT id FROM roles WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

/** Create a membership and return its ID. */
export async function createMembership(
  client: pg.PoolClient,
  id: string,
  userId: string,
  tenantId: string,
  roleId: string,
): Promise<string> {
  await client.query(
    `INSERT INTO memberships (id, user_id, tenant_id, role_id, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $2, $2)`,
    [id, userId, tenantId, roleId],
  );
  return id;
}
