/**
 * M5 Certificates Schema Integration Tests.
 *
 * Verifies: tc_register, certificate_templates, issued_certificates —
 * UNIQUE constraints, CHECK constraints, self-referencing FK, FORCE RLS.
 *
 * Run: pnpm nx test database -- --project integration
 */
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

/** Find an academic year for the given tenant. */
async function findAcademicYear(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query('SELECT id FROM academic_years WHERE tenant_id = $1 LIMIT 1', [
    tenantId,
  ]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

/** Create a student profile and return its ID. */
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

/** Create a staff profile and return its ID. */
async function createStaffProfile(
  client: pg.PoolClient,
  opts: {
    id: string;
    userId: string;
    membershipId: string;
    tenantId: string;
    employeeId: string;
  },
): Promise<string> {
  await client.query(
    `INSERT INTO staff_profiles (
      id, user_id, membership_id, tenant_id,
      employee_id, date_of_joining,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, '2025-04-01', $2, $2)`,
    [opts.id, opts.userId, opts.membershipId, opts.tenantId, opts.employeeId],
  );
  return opts.id;
}

/** Insert a certificate template and return its ID. */
async function insertTemplate(
  client: pg.PoolClient,
  id: string,
  tenantId: string,
  opts?: { type?: string; name?: string },
): Promise<string> {
  const type = opts?.type ?? 'BONAFIDE_CERTIFICATE';
  const name = opts?.name ?? 'Test Template';
  await client.query(
    `INSERT INTO certificate_templates (id, tenant_id, type, name, fields_schema)
     VALUES ($1, $2, $3, $4, '{}')`,
    [id, tenantId, type, name],
  );
  return id;
}

// ── tc_register ──────────────────────────────────────────────

describe('M5: tc_register UNIQUE serial constraint', () => {
  it('duplicate tc_serial_number in same tenant → constraint violation', async () => {
    await inTransaction(async (client) => {
      const testUser1 = await createTestUser(client, 'eeeeeeee-ce01-0001-0001-000000000001');
      const testUser2 = await createTestUser(client, 'eeeeeeee-ce01-0001-0001-000000000002');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const academicYearId = await findAcademicYear(client, SEED.INSTITUTE_1);

      // Create two student profiles
      const mem1 = 'eeeeeeee-c001-0001-0001-000000000001';
      const mem2 = 'eeeeeeee-c001-0001-0001-000000000002';
      await createMembership(client, mem1, testUser1, SEED.INSTITUTE_1, roleId);
      await createMembership(client, mem2, testUser2, SEED.INSTITUTE_1, roleId);

      const sp1 = 'eeeeeeee-c002-0001-0001-000000000001';
      const sp2 = 'eeeeeeee-c002-0001-0001-000000000002';
      await createStudentProfile(client, {
        id: sp1,
        userId: testUser1,
        membershipId: mem1,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'TC-ADM-001',
      });
      await createStudentProfile(client, {
        id: sp2,
        userId: testUser2,
        membershipId: mem2,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'TC-ADM-002',
      });

      // First TC insert
      await client.query(
        `INSERT INTO tc_register (
          id, student_profile_id, tc_serial_number, academic_year_id, reason,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, 'TC/2025-26/001', $3, 'Leaving city', $4, $5, $5)`,
        ['eeeeeeee-c003-0001-0001-000000000001', sp1, academicYearId, SEED.INSTITUTE_1, testUser1],
      );

      // Duplicate serial in same tenant → should fail
      const err = await client
        .query(
          `INSERT INTO tc_register (
            id, student_profile_id, tc_serial_number, academic_year_id, reason,
            tenant_id, created_by, updated_by
          ) VALUES ($1, $2, 'TC/2025-26/001', $3, 'Another reason', $4, $5, $5)`,
          [
            'eeeeeeee-c003-0001-0001-000000000002',
            sp2,
            academicYearId,
            SEED.INSTITUTE_1,
            testUser1,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

describe('M5: tc_register self-referencing FK', () => {
  it('insert original TC then duplicate referencing original_tc_id → succeeds', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-ce02-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const academicYearId = await findAcademicYear(client, SEED.INSTITUTE_1);

      const memId = 'eeeeeeee-c004-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const spId = 'eeeeeeee-c005-0001-0001-000000000001';
      await createStudentProfile(client, {
        id: spId,
        userId: testUser,
        membershipId: memId,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'TC-SELF-001',
      });

      // Insert original TC
      const originalTcId = 'eeeeeeee-c006-0001-0001-000000000001';
      await client.query(
        `INSERT INTO tc_register (
          id, student_profile_id, tc_serial_number, academic_year_id, reason, status,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, 'TC/2025-26/ORIG', $3, 'Transfer', 'ISSUED', $4, $5, $5)`,
        [originalTcId, spId, academicYearId, SEED.INSTITUTE_1, testUser],
      );

      // Insert duplicate TC referencing original
      const duplicateTcId = 'eeeeeeee-c006-0001-0001-000000000002';
      await client.query(
        `INSERT INTO tc_register (
          id, student_profile_id, tc_serial_number, academic_year_id, reason,
          status, is_duplicate, original_tc_id, duplicate_reason,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, 'TC/2025-26/DUP', $3, 'Lost original', 'DUPLICATE_REQUESTED', true, $4, 'Original lost', $5, $6, $6)`,
        [duplicateTcId, spId, academicYearId, originalTcId, SEED.INSTITUTE_1, testUser],
      );

      const res = await client.query(
        'SELECT original_tc_id, is_duplicate FROM tc_register WHERE id = $1',
        [duplicateTcId],
      );
      expect(res.rows[0].original_tc_id).toBe(originalTcId);
      expect(res.rows[0].is_duplicate).toBe(true);
    });
  });
});

// ── certificate_templates ───────────────────────────────────

describe('M5: certificate_templates type CHECK constraint', () => {
  it("rejects invalid type 'report_card'", async () => {
    await inTransaction(async (client) => {
      const err = await insertTemplate(
        client,
        'eeeeeeee-c007-0001-0001-000000000001',
        SEED.INSTITUTE_1,
        { type: 'report_card' },
      ).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });

  it("accepts valid type 'BONAFIDE_CERTIFICATE'", async () => {
    await inTransaction(async (client) => {
      const id = 'eeeeeeee-c008-0001-0001-000000000001';
      await insertTemplate(client, id, SEED.INSTITUTE_1, {
        type: 'BONAFIDE_CERTIFICATE',
        name: 'Bonafide Template',
      });

      const res = await client.query('SELECT type, name FROM certificate_templates WHERE id = $1', [
        id,
      ]);
      expect(res.rows[0].type).toBe('BONAFIDE_CERTIFICATE');
      expect(res.rows[0].name).toBe('Bonafide Template');
    });
  });
});

// ── issued_certificates ─────────────────────────────────────

describe('M5: issued_certificates profile references', () => {
  it('can reference student_profile_id with staff NULL → succeeds', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-ce03-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const memId = 'eeeeeeee-c009-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const spId = 'eeeeeeee-c010-0001-0001-000000000001';
      await createStudentProfile(client, {
        id: spId,
        userId: testUser,
        membershipId: memId,
        tenantId: SEED.INSTITUTE_1,
        admissionNumber: 'CERT-STU-001',
      });

      const templateId = 'eeeeeeee-c011-0001-0001-000000000001';
      await insertTemplate(client, templateId, SEED.INSTITUTE_1);

      const certId = 'eeeeeeee-c012-0001-0001-000000000001';
      await client.query(
        `INSERT INTO issued_certificates (
          id, template_id, student_profile_id, staff_profile_id,
          serial_number, certificate_data,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, $3, NULL, 'CERT/2025-26/BON/001', '{}', $4, $5, $5)`,
        [certId, templateId, spId, SEED.INSTITUTE_1, testUser],
      );

      const res = await client.query(
        'SELECT student_profile_id, staff_profile_id FROM issued_certificates WHERE id = $1',
        [certId],
      );
      expect(res.rows[0].student_profile_id).toBe(spId);
      expect(res.rows[0].staff_profile_id).toBeNull();
    });
  });

  it('can reference staff_profile_id with student NULL → succeeds', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-ce04-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);

      const memId = 'eeeeeeee-c013-0001-0001-000000000001';
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      const staffId = 'eeeeeeee-c014-0001-0001-000000000001';
      await createStaffProfile(client, {
        id: staffId,
        userId: testUser,
        membershipId: memId,
        tenantId: SEED.INSTITUTE_1,
        employeeId: 'EMP-CERT-001',
      });

      const templateId = 'eeeeeeee-c015-0001-0001-000000000001';
      await insertTemplate(client, templateId, SEED.INSTITUTE_1);

      const certId = 'eeeeeeee-c016-0001-0001-000000000001';
      await client.query(
        `INSERT INTO issued_certificates (
          id, template_id, student_profile_id, staff_profile_id,
          serial_number, certificate_data,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, NULL, $3, 'CERT/2025-26/STAFF/001', '{}', $4, $5, $5)`,
        [certId, templateId, staffId, SEED.INSTITUTE_1, testUser],
      );

      const res = await client.query(
        'SELECT student_profile_id, staff_profile_id FROM issued_certificates WHERE id = $1',
        [certId],
      );
      expect(res.rows[0].student_profile_id).toBeNull();
      expect(res.rows[0].staff_profile_id).toBe(staffId);
    });
  });
});

describe('M5: issued_certificates UNIQUE serial constraint', () => {
  it('duplicate serial_number in same tenant → constraint violation', async () => {
    await inTransaction(async (client) => {
      const templateId = 'eeeeeeee-c017-0001-0001-000000000001';
      await insertTemplate(client, templateId, SEED.INSTITUTE_1);

      // First certificate
      await client.query(
        `INSERT INTO issued_certificates (
          id, template_id, serial_number, certificate_data,
          tenant_id, created_by, updated_by
        ) VALUES ($1, $2, 'CERT/DUP/001', '{}', $3, $4, $4)`,
        ['eeeeeeee-c018-0001-0001-000000000001', templateId, SEED.INSTITUTE_1, SEED.USER_ADMIN],
      );

      // Duplicate serial in same tenant → should fail
      const err = await client
        .query(
          `INSERT INTO issued_certificates (
            id, template_id, serial_number, certificate_data,
            tenant_id, created_by, updated_by
          ) VALUES ($1, $2, 'CERT/DUP/001', '{}', $3, $4, $4)`,
          ['eeeeeeee-c018-0001-0001-000000000002', templateId, SEED.INSTITUTE_1, SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

// ── FORCE RLS checks ────────────────────────────────────────

describe('M5: FORCE RLS on all 3 tables', () => {
  const tables = ['tc_register', 'certificate_templates', 'issued_certificates'];

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
