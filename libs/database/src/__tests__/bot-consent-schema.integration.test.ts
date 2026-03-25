/**
 * M7 Bot Profiles, Consent Records & Privacy Notices Integration Tests.
 *
 * Verifies: bot_profiles, consent_records (append-only), privacy_notices —
 * CHECK constraints, UNIQUE constraints, append-only enforcement, FORCE RLS.
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

async function findRole(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query('SELECT id FROM roles WHERE tenant_id = $1 LIMIT 1', [tenantId]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

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

/** Create a student profile with its required membership. Returns studentProfileId. */
async function createStudentProfile(
  client: pg.PoolClient,
  profileId: string,
  memId: string,
  userId: string,
  tenantId: string,
  roleId: string,
  admissionNumber: string,
): Promise<string> {
  await createMembership(client, memId, userId, tenantId, roleId);
  await client.query(
    `INSERT INTO student_profiles (id, user_id, membership_id, tenant_id, admission_number, admission_date, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, '2025-04-01', $2, $2)`,
    [profileId, userId, memId, tenantId, admissionNumber],
  );
  return profileId;
}

/** Create a guardian profile with its required membership. Returns guardianProfileId. */
async function createGuardianProfile(
  client: pg.PoolClient,
  profileId: string,
  memId: string,
  userId: string,
  tenantId: string,
  roleId: string,
): Promise<string> {
  await createMembership(client, memId, userId, tenantId, roleId);
  await client.query(
    `INSERT INTO guardian_profiles (id, user_id, membership_id, tenant_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $2, $2)`,
    [profileId, userId, memId, tenantId],
  );
  return profileId;
}

// ── consent_records: INSERT as roviq_app succeeds ───────────

describe('M7: consent_records append-only enforcement', () => {
  it('INSERT as roviq_app with correct tenant succeeds', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const studentProfileId = await createStudentProfile(
        client,
        'ffffffff-c001-0001-0001-000000000001',
        'ffffffff-c001-0001-0001-000000000010',
        SEED.USER_ADMIN,
        SEED.INSTITUTE_1,
        roleId,
        'CONSENT-S001',
      );

      const guardianProfileId = await createGuardianProfile(
        client,
        'ffffffff-c001-0001-0001-000000000002',
        'ffffffff-c001-0001-0001-000000000020',
        SEED.USER_TEACHER,
        SEED.INSTITUTE_1,
        roleId,
      );

      // Switch to roviq_app with tenant context
      await client.query('SET LOCAL ROLE roviq_app');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
        SEED.INSTITUTE_1,
      ]);

      const consentId = 'ffffffff-c001-0001-0001-000000000099';
      await client.query(
        `INSERT INTO consent_records (id, tenant_id, guardian_profile_id, student_profile_id, purpose, is_granted, granted_at)
         VALUES ($1, $2, $3, $4, 'academic_data_processing', true, now())`,
        [consentId, SEED.INSTITUTE_1, guardianProfileId, studentProfileId],
      );

      const res = await client.query(
        'SELECT id, purpose, is_granted FROM consent_records WHERE id = $1',
        [consentId],
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].purpose).toBe('academic_data_processing');
      expect(res.rows[0].is_granted).toBe(true);
    });
  });

  it('UPDATE as roviq_app is blocked (permission denied / policy violation)', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const studentProfileId = await createStudentProfile(
        client,
        'ffffffff-c002-0001-0001-000000000001',
        'ffffffff-c002-0001-0001-000000000010',
        SEED.USER_ADMIN,
        SEED.INSTITUTE_1,
        roleId,
        'CONSENT-S002',
      );

      const guardianProfileId = await createGuardianProfile(
        client,
        'ffffffff-c002-0001-0001-000000000002',
        'ffffffff-c002-0001-0001-000000000020',
        SEED.USER_TEACHER,
        SEED.INSTITUTE_1,
        roleId,
      );

      // Insert as superuser first
      const consentId = 'ffffffff-c002-0001-0001-000000000099';
      await client.query(
        `INSERT INTO consent_records (id, tenant_id, guardian_profile_id, student_profile_id, purpose, is_granted, granted_at)
         VALUES ($1, $2, $3, $4, 'photo_video_marketing', true, now())`,
        [consentId, SEED.INSTITUTE_1, guardianProfileId, studentProfileId],
      );

      // Switch to roviq_app with tenant context
      await client.query('SET LOCAL ROLE roviq_app');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
        SEED.INSTITUTE_1,
      ]);

      // Attempt UPDATE — should fail (append-only: no UPDATE grant + RLS USING(false))
      const err = await client
        .query('UPDATE consent_records SET is_granted = false WHERE id = $1', [consentId])
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/permission denied|policy/i);
    });
  });

  it('DELETE as roviq_app is blocked (permission denied / policy violation)', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const studentProfileId = await createStudentProfile(
        client,
        'ffffffff-c003-0001-0001-000000000001',
        'ffffffff-c003-0001-0001-000000000010',
        SEED.USER_ADMIN,
        SEED.INSTITUTE_1,
        roleId,
        'CONSENT-S003',
      );

      const guardianProfileId = await createGuardianProfile(
        client,
        'ffffffff-c003-0001-0001-000000000002',
        'ffffffff-c003-0001-0001-000000000020',
        SEED.USER_TEACHER,
        SEED.INSTITUTE_1,
        roleId,
      );

      // Insert as superuser first
      const consentId = 'ffffffff-c003-0001-0001-000000000099';
      await client.query(
        `INSERT INTO consent_records (id, tenant_id, guardian_profile_id, student_profile_id, purpose, is_granted, granted_at)
         VALUES ($1, $2, $3, $4, 'whatsapp_communication', true, now())`,
        [consentId, SEED.INSTITUTE_1, guardianProfileId, studentProfileId],
      );

      // Switch to roviq_app with tenant context
      await client.query('SET LOCAL ROLE roviq_app');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
        SEED.INSTITUTE_1,
      ]);

      // Attempt DELETE — should fail (append-only: no DELETE grant + RLS USING(false))
      const err = await client
        .query('DELETE FROM consent_records WHERE id = $1', [consentId])
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/permission denied|policy/i);
    });
  });

  it('same guardian+student+purpose can have multiple rows (grant then withdraw)', async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const studentProfileId = await createStudentProfile(
        client,
        'ffffffff-c004-0001-0001-000000000001',
        'ffffffff-c004-0001-0001-000000000010',
        SEED.USER_ADMIN,
        SEED.INSTITUTE_1,
        roleId,
        'CONSENT-S004',
      );

      const guardianProfileId = await createGuardianProfile(
        client,
        'ffffffff-c004-0001-0001-000000000002',
        'ffffffff-c004-0001-0001-000000000020',
        SEED.USER_TEACHER,
        SEED.INSTITUTE_1,
        roleId,
      );

      // First row: grant consent
      await client.query(
        `INSERT INTO consent_records (id, tenant_id, guardian_profile_id, student_profile_id, purpose, is_granted, granted_at)
         VALUES ($1, $2, $3, $4, 'aadhaar_collection', true, now())`,
        [
          'ffffffff-c004-0001-0001-000000000091',
          SEED.INSTITUTE_1,
          guardianProfileId,
          studentProfileId,
        ],
      );

      // Second row: withdraw consent (same guardian, student, purpose)
      await client.query(
        `INSERT INTO consent_records (id, tenant_id, guardian_profile_id, student_profile_id, purpose, is_granted, withdrawn_at)
         VALUES ($1, $2, $3, $4, 'aadhaar_collection', false, now())`,
        [
          'ffffffff-c004-0001-0001-000000000092',
          SEED.INSTITUTE_1,
          guardianProfileId,
          studentProfileId,
        ],
      );

      const res = await client.query(
        `SELECT id, is_granted FROM consent_records
         WHERE guardian_profile_id = $1 AND student_profile_id = $2 AND purpose = 'aadhaar_collection'
         ORDER BY created_at`,
        [guardianProfileId, studentProfileId],
      );

      expect(res.rows).toHaveLength(2);
      expect(res.rows[0].is_granted).toBe(true);
      expect(res.rows[1].is_granted).toBe(false);
    });
  });
});

// ── bot_profiles: bot_type CHECK constraint ─────────────────

describe('M7: bot_profiles CHECK constraints', () => {
  it("rejects invalid bot_type 'spam_bot'", async () => {
    await inTransaction(async (client) => {
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const memId = 'ffffffff-b001-0001-0001-000000000010';
      await createMembership(client, memId, SEED.USER_ADMIN, SEED.INSTITUTE_1, roleId);

      const err = await client
        .query(
          `INSERT INTO bot_profiles (id, user_id, membership_id, bot_type, tenant_id, created_by, updated_by)
           VALUES ($1, $2, $3, 'spam_bot', $4, $2, $2)`,
          ['ffffffff-b001-0001-0001-000000000001', SEED.USER_ADMIN, memId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_bot_type|violates check constraint/i);
    });
  });
});

// ── privacy_notices: UNIQUE(tenant_id, version, language) ───

describe('M7: privacy_notices UNIQUE(tenant_id, version, language)', () => {
  it('duplicate version+language for same tenant fails', async () => {
    await inTransaction(async (client) => {
      await client.query(
        `INSERT INTO privacy_notices (id, tenant_id, version, language, content, is_active)
         VALUES ($1, $2, 1, 'en', 'Privacy notice v1 English', true)`,
        ['ffffffff-p001-0001-0001-000000000001', SEED.INSTITUTE_1],
      );

      const err = await client
        .query(
          `INSERT INTO privacy_notices (id, tenant_id, version, language, content, is_active)
           VALUES ($1, $2, 1, 'en', 'Duplicate notice', false)`,
          ['ffffffff-p001-0001-0001-000000000002', SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

// ── FORCE RLS checks ────────────────────────────────────────

describe('M7: FORCE RLS on all 3 tables', () => {
  const tables = ['bot_profiles', 'consent_records', 'privacy_notices'];

  for (const tableName of tables) {
    it(`${tableName} has FORCE ROW LEVEL SECURITY`, async () => {
      const res = await superPool.query(
        'SELECT relforcerowsecurity FROM pg_class WHERE relname = $1',
        [tableName],
      );
      if (res.rows.length > 0) {
        expect(res.rows[0].relforcerowsecurity).toBe(true);
      }
    });
  }
});
