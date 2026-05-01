/**
 * M3 Staff & Guardian Schema Integration Tests (ROV-156).
 *
 * Verifies: staff_profiles, staff_qualifications, guardian_profiles,
 * student_guardian_links — three-tier RLS, constraints, FORCE RLS.
 *
 * Run: pnpm nx test database -- --project integration
 */
import { GuardianRelationship } from '@roviq/common-types';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMembership, createTestUser, findRole, TEST_SUPERUSER_URL } from './test-helpers';

const SUPERUSER_URL = TEST_SUPERUSER_URL;

const SEED = {
  INSTITUTE_1: '00000000-0000-7000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-7000-a000-000000000102',
  USER_ADMIN: '00000000-0000-7000-a000-000000000201',
  USER_TEACHER: '00000000-0000-7000-a000-000000000202',
};

let superPool: pg.Pool;

beforeAll(async () => {
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 3 });
  const res = await superPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await superPool.end();
});

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

// ── student_guardian_links: two primary contacts → constraint violation ──

describe('ROV-156: student_guardian_links', () => {
  it('two primary contacts for same student → constraint violation', async () => {
    await inTransaction(async (client) => {
      const testUser1 = await createTestUser(client, 'eeeeeeee-da01-0001-0001-000000000001');
      const testUser2 = await createTestUser(client, 'eeeeeeee-da01-0001-0001-000000000002');
      const testUser3 = await createTestUser(client, 'eeeeeeee-da01-0001-0001-000000000003');
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      // Create student membership + profile
      const studentMemId = 'eeeeeeee-7001-0001-0001-000000000001';
      await createMembership(client, studentMemId, testUser1, SEED.INSTITUTE_1, roleId);
      const studentProfileId = 'eeeeeeee-7002-0001-0001-000000000001';
      await client.query(
        `INSERT INTO student_profiles (id, user_id, membership_id, tenant_id, admission_number, admission_date, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'SGL-001', '2025-04-01', $2, $2)`,
        [studentProfileId, testUser1, studentMemId, SEED.INSTITUTE_1],
      );

      // Create two guardian memberships + profiles
      const gMem1 = 'eeeeeeee-7003-0001-0001-000000000001';
      const gMem2 = 'eeeeeeee-7003-0001-0001-000000000002';
      await createMembership(client, gMem1, testUser2, SEED.INSTITUTE_1, roleId);
      const gProfile1 = 'eeeeeeee-7004-0001-0001-000000000001';
      const gProfile2 = 'eeeeeeee-7004-0001-0001-000000000002';
      await client.query(
        `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $2, $2)`,
        [gProfile1, testUser2, gMem1, SEED.INSTITUTE_1],
      );
      await createMembership(client, gMem2, testUser3, SEED.INSTITUTE_1, roleId);
      await client.query(
        `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $2, $2)`,
        [gProfile2, testUser3, gMem2, SEED.INSTITUTE_1],
      );

      // First primary contact — succeeds
      await client.query(
        `INSERT INTO student_guardian_links (id, tenant_id, student_profile_id, guardian_profile_id, relationship, is_primary_contact)
         VALUES ($1, $2, $3, $4, '${GuardianRelationship.FATHER}', true)`,
        ['eeeeeeee-7005-0001-0001-000000000001', SEED.INSTITUTE_1, studentProfileId, gProfile1],
      );

      // Second primary contact — should fail
      const err = await client
        .query(
          `INSERT INTO student_guardian_links (id, tenant_id, student_profile_id, guardian_profile_id, relationship, is_primary_contact)
           VALUES ($1, $2, $3, $4, '${GuardianRelationship.MOTHER}', true)`,
          ['eeeeeeee-7005-0001-0001-000000000002', SEED.INSTITUTE_1, studentProfileId, gProfile2],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

// ── staff_qualifications: FK to staff_profiles ──────────

describe('ROV-156: staff_qualifications', () => {
  it('orphan insert (no staff_profile) fails with FK violation', async () => {
    await inTransaction(async (client) => {
      const fakeProfileId = 'eeeeeeee-8001-0001-0001-000000000099';
      const err = await client
        .query(
          `INSERT INTO staff_qualifications (id, staff_profile_id, tenant_id, type, degree_name)
           VALUES ($1, $2, $3, 'ACADEMIC', 'B.Ed')`,
          ['eeeeeeee-8002-0001-0001-000000000001', fakeProfileId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/foreign key|violates/i);
    });
  });

  it('type CHECK rejects invalid qualification type', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-da02-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-8003-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const staffId = 'eeeeeeee-8004-0001-0001-000000000001';
      await client.query(
        `INSERT INTO staff_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $2, $2)`,
        [staffId, testUser, memId, SEED.INSTITUTE_1],
      );

      const err = await client
        .query(
          `INSERT INTO staff_qualifications (id, staff_profile_id, tenant_id, type, degree_name)
           VALUES ($1, $2, $3, 'invalid_type', 'B.Ed')`,
          ['eeeeeeee-8005-0001-0001-000000000001', staffId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── guardian_profiles: annual_income BIGINT (paise) ─────

describe('ROV-156: guardian_profiles', () => {
  it('annual_income stored as BIGINT paise → no decimal truncation', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-da03-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-9001-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const gId = 'eeeeeeee-9002-0001-0001-000000000001';
      // ₹3,00,000 = 30000000 paise
      const incomePaise = '30000000';

      await client.query(
        `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, annual_income, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $2, $2)`,
        [gId, testUser, memId, SEED.INSTITUTE_1, incomePaise],
      );

      const res = await client.query(`SELECT annual_income FROM guardian_profiles WHERE id = $1`, [
        gId,
      ]);
      // BIGINT comes back as string in pg driver
      expect(res.rows[0].annual_income).toBe(incomePaise);
    });
  });

  it('RLS isolation: tenant A guardian invisible to tenant B', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-da04-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-9003-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const gId = 'eeeeeeee-9004-0001-0001-000000000001';
      await client.query(
        `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $2, $2)`,
        [gId, testUser, memId, SEED.INSTITUTE_1],
      );

      // Switch to roviq_app with tenant B context
      await client.query(`SET LOCAL ROLE roviq_app`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        SEED.INSTITUTE_2,
      ]);

      const res = await client.query(`SELECT id FROM guardian_profiles WHERE id = $1`, [gId]);
      expect(res.rows).toHaveLength(0);
    });
  });

  it('roviq_reseller: SELECT succeeds, INSERT fails (read-only)', async () => {
    await inTransaction(async (client) => {
      // Switch to roviq_reseller
      await client.query(`SET LOCAL ROLE roviq_reseller`);

      // SELECT should not error (may return 0 rows without reseller context)
      const selectRes = await client.query(`SELECT id FROM guardian_profiles LIMIT 1`);
      expect(selectRes.rows).toBeDefined();

      // INSERT should fail
      const err = await client
        .query(
          `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $2, $2)`,
          [
            'eeeeeeee-9005-0001-0001-000000000001',
            SEED.USER_TEACHER,
            'eeeeeeee-9005-0001-0001-000000000099',
            SEED.INSTITUTE_1,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/permission denied|policy/i);
    });
  });
});

// ── FORCE RLS checks ────────────────────────────────────

describe('ROV-156: FORCE RLS on all 4 tables', () => {
  const tables = [
    'staff_profiles',
    'staff_qualifications',
    'guardian_profiles',
    'student_guardian_links',
  ];

  for (const tableName of tables) {
    it(`${tableName} has FORCE ROW LEVEL SECURITY`, async () => {
      const res = await superPool.query(
        `SELECT relforcerowsecurity FROM pg_class WHERE relname = $1`,
        [tableName],
      );
      if (res.rows.length > 0) {
        expect(res.rows[0].relforcerowsecurity).toBe(true);
      }
    });
  }
});
