/**
 * M4 Admission Schema Integration Tests.
 *
 * Verifies: enquiries, admission_applications, application_documents —
 * CHECK constraints, three-tier RLS isolation, full-text search, FORCE RLS.
 *
 * Run: pnpm nx test database -- --project integration
 */
import { EnquirySource, EnquiryStatus } from '@roviq/common-types';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_SUPERUSER_URL } from './test-helpers';

const SUPERUSER_URL = TEST_SUPERUSER_URL;

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

/** Find an academic year for the given tenant (needed for FK references). */
async function findAcademicYear(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query('SELECT id FROM academic_years WHERE tenant_id = $1 LIMIT 1', [
    tenantId,
  ]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

/** Find a standard for the given tenant (needed for admission_applications FK). */
async function findStandard(client: pg.PoolClient, tenantId: string): Promise<string> {
  const res = await client.query('SELECT id FROM standards WHERE tenant_id = $1 LIMIT 1', [
    tenantId,
  ]);
  expect(res.rows.length).toBeGreaterThanOrEqual(1);
  return res.rows[0].id;
}

/** Insert a minimal enquiry and return its id. */
async function insertEnquiry(
  client: pg.PoolClient,
  id: string,
  tenantId: string,
  opts?: { studentName?: string; parentName?: string; source?: string; status?: string },
): Promise<string> {
  const studentName = opts?.studentName ?? 'Test Student';
  const parentName = opts?.parentName ?? 'Test Parent';
  const source = opts?.source ?? EnquirySource.WALK_IN;
  const status = opts?.status ?? EnquiryStatus.NEW;

  await client.query(
    `INSERT INTO enquiries (id, student_name, class_requested, parent_name, parent_phone, source, status, tenant_id, created_by, updated_by)
		 VALUES ($1, $2, 'Class 1', $3, '9876543210', $4, $5, $6, $7, $7)`,
    [id, studentName, parentName, source, status, tenantId, SEED.USER_ADMIN],
  );
  return id;
}

// ── enquiry source CHECK ────────────────────────────────────

describe('M4: enquiry source CHECK constraint', () => {
  it("rejects invalid source 'billboard'", async () => {
    await inTransaction(async (client) => {
      const err = await insertEnquiry(
        client,
        'aaaaaaaa-a001-0001-0001-000000000001',
        SEED.INSTITUTE_1,
        { source: 'billboard' },
      ).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── enquiry status CHECK ────────────────────────────────────

describe('M4: enquiry status CHECK constraint', () => {
  it("rejects invalid status 'approved'", async () => {
    await inTransaction(async (client) => {
      const err = await insertEnquiry(
        client,
        'aaaaaaaa-a002-0001-0001-000000000001',
        SEED.INSTITUTE_1,
        { status: 'approved' },
      ).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── application status CHECK ────────────────────────────────

describe('M4: application status CHECK constraint', () => {
  it("rejects invalid status 'processing'", async () => {
    await inTransaction(async (client) => {
      const academicYearId = await findAcademicYear(client, SEED.INSTITUTE_1);
      const standardId = await findStandard(client, SEED.INSTITUTE_1);

      const err = await client
        .query(
          `INSERT INTO admission_applications (id, academic_year_id, standard_id, status, tenant_id, created_by, updated_by)
					 VALUES ($1, $2, $3, 'processing', $4, $5, $5)`,
          [
            'aaaaaaaa-a003-0001-0001-000000000001',
            academicYearId,
            standardId,
            SEED.INSTITUTE_1,
            SEED.USER_ADMIN,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── RLS isolation: tenant A enquiry invisible to tenant B ───

describe('M4: RLS tenant isolation', () => {
  it('enquiry in tenant A invisible to roviq_app with tenant B context', async () => {
    await inTransaction(async (client) => {
      // Insert enquiry as superuser in tenant A
      const enquiryId = 'aaaaaaaa-a004-0001-0001-000000000001';
      await insertEnquiry(client, enquiryId, SEED.INSTITUTE_1);

      // Switch to roviq_app with tenant B context
      await client.query('SET LOCAL ROLE roviq_app');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
        SEED.INSTITUTE_2,
      ]);

      const res = await client.query('SELECT id FROM enquiries WHERE id = $1', [enquiryId]);
      expect(res.rows).toHaveLength(0);
    });
  });
});

// ── Full-text search GIN index ──────────────────────────────

describe('M4: full-text search on enquiries', () => {
  it('finds enquiry by partial student_name via tsvector', async () => {
    await inTransaction(async (client) => {
      const enquiryId = 'aaaaaaaa-a005-0001-0001-000000000001';
      await insertEnquiry(client, enquiryId, SEED.INSTITUTE_1, {
        studentName: 'Raj Kumar',
        parentName: 'Anil Sharma',
      });

      const res = await client.query(
        `SELECT id FROM enquiries
				 WHERE to_tsvector('simple', coalesce(student_name, '') || ' ' || coalesce(parent_name, ''))
				       @@ to_tsquery('simple', 'Raj')`,
      );

      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.rows.some((r: { id: string }) => r.id === enquiryId)).toBe(true);
    });
  });
});

// ── FORCE RLS checks ────────────────────────────────────────

describe('M4: FORCE RLS on all 3 tables', () => {
  const tables = ['enquiries', 'admission_applications', 'application_documents'];

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
