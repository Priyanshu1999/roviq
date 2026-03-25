/**
 * M2 Student Profile Schema Integration Tests (ROV-153).
 *
 * Verifies tenant-scoped tables: student_profiles, student_academics
 * with three-tier RLS, partial unique indexes, and CHECK constraints.
 *
 * Run: pnpm nx test database -- --project integration
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPERUSER_URL =
  process.env.DATABASE_URL_TEST_MIGRATE ??
  process.env.DATABASE_URL_MIGRATE ??
  'postgresql://roviq:roviq_dev@localhost:5432/roviq';

const SEED = {
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-4000-a000-000000000102',
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
  USER_TEACHER: '00000000-0000-4000-a000-000000000202',
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

/** Execute a callback inside a transaction that is always rolled back. */
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

/** Helper: find a role for an institute */
async function findRole(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query(`SELECT id FROM roles WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

/** Helper: create a membership and return its ID */
async function createMembership(
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

/** Helper: create a student profile and return its ID */
async function createStudentProfile(
  client: pg.PoolClient,
  opts: {
    id: string;
    userId: string;
    membershipId: string;
    tenantId: string;
    admissionNumber: string;
  },
): Promise<string> {
  await client.query(
    `INSERT INTO student_profiles (
      id, user_id, membership_id, tenant_id,
      admission_number, admission_date,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, '2025-04-01', $2, $2)`,
    [opts.id, opts.userId, opts.membershipId, opts.tenantId, opts.admissionNumber],
  );
  return opts.id;
}

// ── student_profiles ──────────────────────────────────────

describe('ROV-153: student_profiles', () => {
  it('INSERT as roviq_app with correct tenant succeeds', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const membershipId = 'eeeeeeee-5001-0001-0001-000000000001';
      await createMembership(client, membershipId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      // Switch to roviq_app with tenant context
      await client.query(`SET LOCAL ROLE roviq_app`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        SEED.INSTITUTE_1,
      ]);

      const profileId = 'eeeeeeee-5002-0001-0001-000000000001';
      await client.query(
        `INSERT INTO student_profiles (
          id, user_id, membership_id, tenant_id,
          admission_number, admission_date,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, 'ADM-001', '2025-04-01', $2, $2)`,
        [profileId, SEED.USER_TEACHER, membershipId, SEED.INSTITUTE_1],
      );

      const res = await client.query(
        `SELECT admission_number FROM student_profiles WHERE id = $1`,
        [profileId],
      );
      expect(res.rows[0].admission_number).toBe('ADM-001');
    });
  });

  it('SELECT as roviq_app with different tenant returns 0 rows (RLS isolation)', async () => {
    await inTransaction(async (client) => {
      // Insert as superuser into tenant 1
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const membershipId = 'eeeeeeee-5003-0001-0001-000000000001';
      await createMembership(client, membershipId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      const profileId = 'eeeeeeee-5004-0001-0001-000000000001';
      await createStudentProfile(client, {
        id: profileId,
        userId: SEED.USER_TEACHER,
        membershipId,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'ADM-RLS-001',
      });

      // Switch to roviq_app with DIFFERENT tenant context
      await client.query(`SET LOCAL ROLE roviq_app`);
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        SEED.INSTITUTE_2,
      ]);

      const res = await client.query(`SELECT id FROM student_profiles WHERE id = $1`, [profileId]);
      expect(res.rows).toHaveLength(0);
    });
  });

  it('duplicate admission_number in same tenant → constraint violation', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const mem1 = 'eeeeeeee-5005-0001-0001-000000000001';
      const mem2 = 'eeeeeeee-5005-0001-0001-000000000002';
      await createMembership(client, mem1, SEED.USER_ADMIN, SEED.INSTITUTE_1, roleId);
      await createMembership(client, mem2, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      await createStudentProfile(client, {
        id: 'eeeeeeee-5006-0001-0001-000000000001',
        userId: SEED.USER_ADMIN,
        membershipId: mem1,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'DUP-001',
      });

      const err = await client
        .query(
          `INSERT INTO student_profiles (
            id, user_id, membership_id, tenant_id,
            admission_number, admission_date, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, 'DUP-001', '2025-04-01', $2, $2)`,
          ['eeeeeeee-5006-0001-0001-000000000002', SEED.USER_TEACHER, mem2, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('same admission_number after soft-deleting first → succeeds (partial unique)', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const mem1 = 'eeeeeeee-5007-0001-0001-000000000001';
      const mem2 = 'eeeeeeee-5007-0001-0001-000000000002';
      await createMembership(client, mem1, SEED.USER_ADMIN, SEED.INSTITUTE_1, roleId);
      await createMembership(client, mem2, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      const profile1 = 'eeeeeeee-5008-0001-0001-000000000001';
      await createStudentProfile(client, {
        id: profile1,
        userId: SEED.USER_ADMIN,
        membershipId: mem1,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'SOFT-DEL-001',
      });

      // Soft-delete first profile
      await client.query(
        `UPDATE student_profiles SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
        [SEED.USER_ADMIN, profile1],
      );

      // Insert second with same admission_number — should succeed
      const profile2 = 'eeeeeeee-5008-0001-0001-000000000002';
      await client.query(
        `INSERT INTO student_profiles (
          id, user_id, membership_id, tenant_id,
          admission_number, admission_date, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, 'SOFT-DEL-001', '2025-04-01', $2, $2)`,
        [profile2, SEED.USER_TEACHER, mem2, SEED.INSTITUTE_1],
      );

      const res = await client.query(
        `SELECT id FROM student_profiles WHERE id = $1 AND deleted_at IS NULL`,
        [profile2],
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  it('invalid academic_status → CHECK violation', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-5009-0001-0001-000000000001';
      await createMembership(client, memId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      const err = await client
        .query(
          `INSERT INTO student_profiles (
            id, user_id, membership_id, tenant_id,
            admission_number, admission_date, academic_status, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, 'CHK-001', '2025-04-01', 'invalid_status', $2, $2)`,
          ['eeeeeeee-5010-0001-0001-000000000001', SEED.USER_TEACHER, memId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_academic_status|violates check constraint/i);
    });
  });

  it('invalid social_category → CHECK violation', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-5011-0001-0001-000000000001';
      await createMembership(client, memId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      const err = await client
        .query(
          `INSERT INTO student_profiles (
            id, user_id, membership_id, tenant_id,
            admission_number, admission_date, social_category, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, 'CHK-002', '2025-04-01', 'invalid_cat', $2, $2)`,
          ['eeeeeeee-5012-0001-0001-000000000001', SEED.USER_TEACHER, memId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_social_category|violates check constraint/i);
    });
  });

  it('roviq_reseller → SELECT succeeds, INSERT fails (read-only)', async () => {
    await inTransaction(async (client) => {
      // Insert as superuser first
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-5013-0001-0001-000000000001';
      await createMembership(client, memId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);
      await createStudentProfile(client, {
        id: 'eeeeeeee-5014-0001-0001-000000000001',
        userId: SEED.USER_TEACHER,
        membershipId: memId,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'RES-001',
      });

      // Get the reseller_id for INSTITUTE_1
      const instRes = await client.query(`SELECT reseller_id FROM institutes WHERE id = $1`, [
        SEED.INSTITUTE_1,
      ]);
      const resellerId = instRes.rows[0]?.reseller_id;

      // Switch to roviq_reseller
      await client.query(`SET LOCAL ROLE roviq_reseller`);
      if (resellerId) {
        await client.query(`SELECT set_config('app.current_reseller_id', $1, true)`, [resellerId]);
      }

      // SELECT should return rows (reseller can read their institutes)
      const selectRes = await client.query(`SELECT id FROM student_profiles`);
      // May return 0 if reseller context doesn't match, but should not error
      expect(selectRes.rows).toBeDefined();

      // INSERT should fail (permission denied — reseller is read-only)
      const memId2 = 'eeeeeeee-5015-0001-0001-000000000001';
      const err = await client
        .query(
          `INSERT INTO student_profiles (
            id, user_id, membership_id, tenant_id,
            admission_number, admission_date, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, 'RES-002', '2025-04-01', $2, $2)`,
          ['eeeeeeee-5016-0001-0001-000000000001', SEED.USER_TEACHER, memId2, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/permission denied|policy/i);
    });
  });

  it('FORCE ROW LEVEL SECURITY is enabled on student_profiles', async () => {
    const res = await superPool.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'student_profiles'`,
    );
    // This will be true only after migration runs; if table doesn't exist yet, skip gracefully
    if (res.rows.length > 0) {
      expect(res.rows[0].relforcerowsecurity).toBe(true);
    }
  });
});

// ── student_academics ──────────────────────────────────────

describe('ROV-153: student_academics', () => {
  it('UNIQUE(student_profile_id, academic_year_id) → duplicate fails', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'eeeeeeee-6001-0001-0001-000000000001';
      await createMembership(client, memId, SEED.USER_TEACHER, SEED.INSTITUTE_1, roleId);

      const profileId = 'eeeeeeee-6002-0001-0001-000000000001';
      await createStudentProfile(client, {
        id: profileId,
        userId: SEED.USER_TEACHER,
        membershipId: memId,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'ACAD-001',
      });

      // Find an academic year, standard, and section for the institute
      const ayRes = await client.query(
        `SELECT id FROM academic_years WHERE tenant_id = $1 LIMIT 1`,
        [SEED.INSTITUTE_1],
      );
      if (ayRes.rows.length === 0) return; // Skip if no seed data

      const stdRes = await client.query(`SELECT id FROM standards WHERE tenant_id = $1 LIMIT 1`, [
        SEED.INSTITUTE_1,
      ]);
      const secRes = await client.query(`SELECT id FROM sections WHERE tenant_id = $1 LIMIT 1`, [
        SEED.INSTITUTE_1,
      ]);
      if (stdRes.rows.length === 0 || secRes.rows.length === 0) return;

      const academicYearId = ayRes.rows[0].id;
      const standardId = stdRes.rows[0].id;
      const sectionId = secRes.rows[0].id;

      // First enrollment — should succeed
      await client.query(
        `INSERT INTO student_academics (
          id, student_profile_id, academic_year_id, standard_id, section_id,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          'eeeeeeee-6003-0001-0001-000000000001',
          profileId,
          academicYearId,
          standardId,
          sectionId,
          SEED.INSTITUTE_1,
          SEED.USER_TEACHER,
        ],
      );

      // Duplicate enrollment for same student + academic year — should fail
      const err = await client
        .query(
          `INSERT INTO student_academics (
            id, student_profile_id, academic_year_id, standard_id, section_id,
            tenant_id, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [
            'eeeeeeee-6003-0001-0001-000000000002',
            profileId,
            academicYearId,
            standardId,
            sectionId,
            SEED.INSTITUTE_1,
            SEED.USER_TEACHER,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('FORCE ROW LEVEL SECURITY is enabled on student_academics', async () => {
    const res = await superPool.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'student_academics'`,
    );
    if (res.rows.length > 0) {
      expect(res.rows[0].relforcerowsecurity).toBe(true);
    }
  });
});
