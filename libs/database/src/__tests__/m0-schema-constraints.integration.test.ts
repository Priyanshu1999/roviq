/**
 * M0 Schema Constraint Integration Tests (ROV-148, ROV-149, ROV-150).
 *
 * Verifies the new unique constraints and indexes after M0 migration:
 * - ROV-148: memberships UNIQUE(user_id, tenant_id, role_id)
 * - ROV-150: phone_numbers partial unique index (one primary per user)
 *
 * Run: pnpm nx test database --testPathPattern=m0-schema-constraints
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPERUSER_URL =
  process.env.DATABASE_URL_TEST_MIGRATE ??
  process.env.DATABASE_URL_MIGRATE ??
  'postgresql://roviq:roviq_dev@localhost:5432/roviq';

const SEED = {
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
  USER_TEACHER: '00000000-0000-4000-a000-000000000202',
};

let superPool: pg.Pool;

beforeAll(async () => {
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 2 });
  const res = await superPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await superPool.end();
});

/**
 * Execute a callback inside a transaction that is always rolled back.
 */
async function inTransaction(fn: (client: pg.PoolClient) => Promise<void>): Promise<void> {
  const client = await superPool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

// ── ROV-148: Membership dual-role constraint ──────────────────

describe('ROV-148: memberships UNIQUE(user_id, tenant_id, role_id)', () => {
  it('allows two memberships for same user+tenant with different roles', async () => {
    await inTransaction(async (client) => {
      // First, find two different roles for INSTITUTE_1
      const rolesRes = await client.query(`SELECT id FROM roles WHERE tenant_id = $1 LIMIT 2`, [
        SEED.INSTITUTE_1,
      ]);
      expect(rolesRes.rows.length).toBeGreaterThanOrEqual(2);
      const [role1, role2] = rolesRes.rows;

      const membershipId1 = 'eeeeeeee-0001-0001-0001-000000000001';
      const membershipId2 = 'eeeeeeee-0001-0001-0001-000000000002';

      // Insert first membership
      await client.query(
        `INSERT INTO memberships (id, user_id, tenant_id, role_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $2, $2)`,
        [membershipId1, SEED.USER_TEACHER, SEED.INSTITUTE_1, role1.id],
      );

      // Insert second membership with DIFFERENT role — should succeed
      await client.query(
        `INSERT INTO memberships (id, user_id, tenant_id, role_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $2, $2)`,
        [membershipId2, SEED.USER_TEACHER, SEED.INSTITUTE_1, role2.id],
      );

      // Verify both exist
      const res = await client.query(
        `SELECT id FROM memberships WHERE user_id = $1 AND tenant_id = $2 AND id IN ($3, $4)`,
        [SEED.USER_TEACHER, SEED.INSTITUTE_1, membershipId1, membershipId2],
      );
      expect(res.rows).toHaveLength(2);
    });
  });

  it('rejects two memberships for same user+tenant with SAME role', async () => {
    await inTransaction(async (client) => {
      const rolesRes = await client.query(`SELECT id FROM roles WHERE tenant_id = $1 LIMIT 1`, [
        SEED.INSTITUTE_1,
      ]);
      const roleId = rolesRes.rows[0].id;

      const membershipId1 = 'eeeeeeee-0002-0001-0001-000000000001';
      const membershipId2 = 'eeeeeeee-0002-0001-0001-000000000002';

      // Insert first membership
      await client.query(
        `INSERT INTO memberships (id, user_id, tenant_id, role_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $2, $2)`,
        [membershipId1, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId],
      );

      // Insert duplicate (same user, tenant, role) — should fail
      const err = await client
        .query(
          `INSERT INTO memberships (id, user_id, tenant_id, role_id, status, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'ACTIVE', $2, $2)`,
          [membershipId2, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

// ── ROV-150: Phone numbers primary partial unique index ───────

describe('ROV-150: phone_numbers partial unique (one primary per user)', () => {
  it('rejects two primary phones for the same user', async () => {
    await inTransaction(async (client) => {
      const phoneId1 = 'eeeeeeee-0003-0001-0001-000000000001';
      const phoneId2 = 'eeeeeeee-0003-0001-0001-000000000002';

      // Insert first primary phone
      await client.query(
        `INSERT INTO phone_numbers (id, user_id, country_code, number, is_primary, label)
         VALUES ($1, $2, '+91', '9000000001', true, 'personal')`,
        [phoneId1, SEED.USER_TEACHER],
      );

      // Insert second primary phone — should fail (partial unique index)
      const err = await client
        .query(
          `INSERT INTO phone_numbers (id, user_id, country_code, number, is_primary, label)
           VALUES ($1, $2, '+91', '9000000002', true, 'work')`,
          [phoneId2, SEED.USER_TEACHER],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('allows one primary + one non-primary phone for the same user', async () => {
    await inTransaction(async (client) => {
      const phoneId1 = 'eeeeeeee-0004-0001-0001-000000000001';
      const phoneId2 = 'eeeeeeee-0004-0001-0001-000000000002';

      // Insert primary phone
      await client.query(
        `INSERT INTO phone_numbers (id, user_id, country_code, number, is_primary, label)
         VALUES ($1, $2, '+91', '9100000001', true, 'personal')`,
        [phoneId1, SEED.USER_TEACHER],
      );

      // Insert non-primary phone — should succeed
      await client.query(
        `INSERT INTO phone_numbers (id, user_id, country_code, number, is_primary, label)
         VALUES ($1, $2, '+91', '9100000002', false, 'work')`,
        [phoneId2, SEED.USER_TEACHER],
      );

      // Verify both exist
      const res = await client.query(
        `SELECT id, is_primary FROM phone_numbers WHERE user_id = $1 AND id IN ($2, $3)`,
        [SEED.USER_TEACHER, phoneId1, phoneId2],
      );
      expect(res.rows).toHaveLength(2);
    });
  });
});

// ── ROV-149: Verify profiles and student_guardians tables are dropped ──

describe('ROV-149: profiles and student_guardians tables dropped', () => {
  it('profiles table does not exist', async () => {
    const res = await superPool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
      ) AS exists`,
    );
    expect(res.rows[0].exists).toBe(false);
  });

  it('student_guardians table does not exist', async () => {
    const res = await superPool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'student_guardians'
      ) AS exists`,
    );
    expect(res.rows[0].exists).toBe(false);
  });
});
