/**
 * Institute Service RLS Security Invariant Tests (ROV-129, PRD §18.1).
 *
 * 12 tests proving the three-scope RLS security model works at the
 * PostgreSQL level. All tests use real PostgreSQL with SET LOCAL ROLE.
 * Each test wraps in a transaction with ROLLBACK — no data leaks.
 *
 * Run: pnpm nx test database --testPathPattern=institute-rls-invariants
 * Requires: seeded DB with pnpm db:reset --seed
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_POOLER_URL, TEST_SUPERUSER_URL } from './test-helpers';

const POOLER_URL = TEST_POOLER_URL;
const SUPERUSER_URL = TEST_SUPERUSER_URL;

const SEED = {
  RESELLER_DIRECT: '00000000-0000-4000-a000-000000000011',
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-4000-a000-000000000102',
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
};

/** All institute-service tables that must have FORCE RLS */
const INSTITUTE_TABLES = [
  'institutes',
  'institute_branding',
  'institute_configs',
  'institute_identifiers',
  'institute_affiliations',
  'institute_groups',
  'academic_years',
  'standards',
  'sections',
  'subjects',
  'standard_subjects',
  'section_subjects',
];

let poolerPool: pg.Pool;
let superPool: pg.Pool;

async function asRole(
  role: string,
  vars: Record<string, string>,
  fn: (client: pg.PoolClient) => Promise<void>,
): Promise<void> {
  const client = await poolerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    for (const [key, value] of Object.entries(vars)) {
      await client.query('SELECT set_config($1, $2, true)', [key, value]);
    }
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

beforeAll(async () => {
  poolerPool = new pg.Pool({ connectionString: POOLER_URL, max: 5 });
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 2 });

  const res = await poolerPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await poolerPool.end();
  await superPool.end();
});

// ═══════════════════════════════════════════════════════
// 12 RLS Security Invariants (PRD §18.1)
// ═══════════════════════════════════════════════════════

describe('Invariant 1: roviq_pooler without SET LOCAL ROLE', () => {
  it('cannot SELECT on standards — permission denied', async () => {
    const client = await poolerPool.connect();
    try {
      await expect(client.query('SELECT * FROM standards LIMIT 1')).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      client.release();
    }
  });
});

describe('Invariant 2: roviq_app tenant isolation on standards', () => {
  it('tenant A sees only tenant A standards', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT tenant_id FROM standards');
      for (const row of res.rows) {
        expect(row.tenant_id).toBe(SEED.INSTITUTE_1);
      }
    });
  });
});

describe('Invariant 3: roviq_app cross-tenant isolation', () => {
  it('tenant A context returns 0 rows for tenant B standards', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM standards WHERE tenant_id = $1', [
        SEED.INSTITUTE_2,
      ]);
      expect(res.rows).toHaveLength(0);
    });
  });
});

describe('Invariant 4: roviq_app cannot read platform_memberships', () => {
  it('returns 0 rows (no GRANT, no policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM platform_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });
});

describe('Invariant 5: roviq_app cannot read reseller_memberships', () => {
  it('returns 0 rows', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM reseller_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });
});

describe('Invariant 6: roviq_reseller sees only their institutes', () => {
  it('reseller A sees only reseller A institutes', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        const res = await client.query('SELECT reseller_id FROM institutes');
        expect(res.rows.length).toBeGreaterThanOrEqual(1);
        for (const row of res.rows) {
          expect(row.reseller_id).toBe(SEED.RESELLER_DIRECT);
        }
      },
    );
  });
});

describe('Invariant 7: roviq_reseller cross-reseller isolation', () => {
  it('reseller A cannot see reseller B institutes', async () => {
    const fakeResellerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': fakeResellerId },
      async (client) => {
        const res = await client.query('SELECT * FROM institutes');
        expect(res.rows).toHaveLength(0);
      },
    );
  });
});

describe('Invariant 8: roviq_reseller cannot INSERT into standards', () => {
  it('blocked by RLS policy (no INSERT policy for reseller on tenant tables)', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO standards (tenant_id, academic_year_id, name, numeric_order, created_by, updated_by)
             VALUES ($1, '00000000-0000-0000-0000-000000000000', $3::jsonb, 99, $2, $2)`,
            [SEED.INSTITUTE_1, SEED.USER_ADMIN, JSON.stringify({ en: 'Hacked' })],
          ),
        ).rejects.toThrow(/permission denied|row-level security/);
      },
    );
  });
});

describe('Invariant 9: roviq_reseller cannot DELETE from institutes', () => {
  it('permission denied (no DELETE GRANT)', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        await expect(
          client.query('DELETE FROM institutes WHERE id = $1', [SEED.INSTITUTE_1]),
        ).rejects.toThrow(/permission denied/);
      },
    );
  });
});

describe('Invariant 10: roviq_admin sees all data', () => {
  it('admin can query any table and get data', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      const institutes = await client.query('SELECT count(*) FROM institutes');
      expect(Number(institutes.rows[0].count)).toBeGreaterThanOrEqual(2);

      // Admin can query tenant-scoped tables without errors (data may or may not exist)
      const standards = await client.query('SELECT count(*) FROM standards');
      expect(Number(standards.rows[0].count)).toBeGreaterThanOrEqual(0);

      const academicYears = await client.query('SELECT count(*) FROM academic_years');
      expect(Number(academicYears.rows[0].count)).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Invariant 11: roviq_admin with FORCE RLS sees all rows', () => {
  it('admin sees all institutes regardless of tenant context', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      const res = await client.query(
        'SELECT DISTINCT reseller_id FROM institutes WHERE deleted_at IS NULL',
      );
      // Admin should see institutes across all resellers
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Invariant 12: FORCE ROW LEVEL SECURITY on all tables', () => {
  it('every institute-service table has relforcerowsecurity = true', async () => {
    const res = await superPool.query(
      `SELECT c.relname, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1)
       ORDER BY c.relname`,
      [INSTITUTE_TABLES],
    );

    const tableMap = new Map(res.rows.map((r) => [r.relname, r.relforcerowsecurity]));

    for (const table of INSTITUTE_TABLES) {
      const hasForceRls = tableMap.get(table);
      expect(hasForceRls, `${table} should have FORCE RLS`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════
// Business Logic Tests
// ═══════════════════════════════════════════════════════

describe('Business logic: Contact JSONB validation', () => {
  it('validates primary phone requirement', async () => {
    const { instituteContactSchema } = await import('../schema/common/validators');

    // No primary phone — should fail
    const noPrimary = instituteContactSchema.safeParse({
      phones: [
        {
          countryCode: '+91',
          number: '9876543210',
          isPrimary: false,
          isWhatsappEnabled: true,
          label: 'Office',
        },
      ],
      emails: [],
    });
    expect(noPrimary.success).toBe(false);

    // Valid contact — should pass
    const valid = instituteContactSchema.safeParse({
      phones: [
        {
          countryCode: '+91',
          number: '9876543210',
          isPrimary: true,
          isWhatsappEnabled: true,
          label: 'Office',
        },
      ],
      emails: [],
    });
    expect(valid.success).toBe(true);
  });

  it('validates Indian phone number length', async () => {
    const { instituteContactSchema } = await import('../schema/common/validators');

    const shortNumber = instituteContactSchema.safeParse({
      phones: [
        {
          countryCode: '+91',
          number: '12345',
          isPrimary: true,
          isWhatsappEnabled: true,
          label: 'Office',
        },
      ],
      emails: [],
    });
    expect(shortNumber.success).toBe(false);
  });

  it('requires at least one WhatsApp-enabled phone', async () => {
    const { instituteContactSchema } = await import('../schema/common/validators');

    const noWhatsapp = instituteContactSchema.safeParse({
      phones: [
        {
          countryCode: '+91',
          number: '9876543210',
          isPrimary: true,
          isWhatsappEnabled: false,
          label: 'Office',
        },
      ],
      emails: [],
    });
    expect(noWhatsapp.success).toBe(false);
  });
});

describe('Business logic: Partial unique index — one active year per institute', () => {
  it('only one active academic year exists per seeded institute', async () => {
    const res = await superPool.query(
      `SELECT tenant_id, count(*) as active_count
       FROM academic_years
       WHERE is_active = true AND deleted_at IS NULL
       GROUP BY tenant_id
       HAVING count(*) > 1`,
    );
    expect(res.rows).toHaveLength(0);
  });
});

describe('Business logic: CHECK constraint — start_date < end_date', () => {
  it('database rejects academic year with end_date before start_date', async () => {
    await expect(
      superPool.query(
        `INSERT INTO academic_years (tenant_id, label, start_date, end_date, status, created_by, updated_by)
         VALUES ($1, 'Bad Dates', '2030-04-01', '2029-03-31', 'PLANNING', $2, $2)`,
        [SEED.INSTITUTE_1, SEED.USER_ADMIN],
      ),
    ).rejects.toThrow(/academic_years_date_check/);
  });
});
