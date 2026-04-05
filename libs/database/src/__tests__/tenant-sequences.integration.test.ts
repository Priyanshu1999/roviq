/**
 * Integration tests for tenant_sequences table + next_sequence_value() function (ROV-152).
 *
 * Verifies:
 * 1. Atomic increment returns next value + formatted string
 * 2. Sequential calls produce gap-free values
 * 3. 100 concurrent calls produce unique values (no gaps, no duplicates)
 * 4. Format template with prefix resolves correctly
 * 5. BIGINT overflow: current_value handles values beyond 2^31
 * 6. Missing sequence returns empty result (not an error)
 * 7. RLS: cross-tenant isolation (tenant A cannot increment tenant B's sequence)
 * 8. RLS: roviq_reseller can SELECT but not UPDATE sequences
 *
 * Run: pnpm nx test database --testPathPattern=tenant-sequences
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const POOLER_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5432/roviq';

const SUPERUSER_URL =
  process.env.DATABASE_URL_TEST_MIGRATE ??
  process.env.DATABASE_URL_MIGRATE ??
  'postgresql://roviq:roviq_dev@localhost:5432/roviq';

/** Seed IDs — must match scripts/seed-ids.ts */
const SEED = {
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-4000-a000-000000000102',
};

let poolerPool: pg.Pool;
let superPool: pg.Pool;

/** Execute a callback as a specific role within a transaction (always rolled back). */
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

/** Insert a test sequence via superuser (committed, cleaned up in afterAll). */
async function seedSequence(
  tenantId: string,
  name: string,
  opts: { prefix?: string; format?: string; currentValue?: number } = {},
): Promise<void> {
  await superPool.query(
    `INSERT INTO tenant_sequences (tenant_id, sequence_name, current_value, prefix, format_template)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [tenantId, name, opts.currentValue ?? 0, opts.prefix ?? null, opts.format ?? null],
  );
}

beforeAll(async () => {
  poolerPool = new pg.Pool({ connectionString: POOLER_URL, max: 20 });
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 5 });

  // Verify connectivity
  const res = await poolerPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);

  // Seed test sequences via superuser
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_basic');
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_serial');
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_concurrent');
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_format', {
    prefix: 'N-',
    format: '{prefix}2025/{value:04d}',
  });
  await seedSequence(SEED.INSTITUTE_2, 'test_seq_isolation');
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_rls_read');
  // BIGINT overflow test: start just below 2^31 to prove BIGINT works beyond INT range
  await seedSequence(SEED.INSTITUTE_1, 'test_seq_bigint', {
    currentValue: 2_147_483_646,
  });
});

afterAll(async () => {
  // Clean up all test sequences
  await superPool.query(`DELETE FROM tenant_sequences WHERE sequence_name LIKE 'test_seq_%'`);
  await poolerPool.end();
  await superPool.end();
});

describe('tenant_sequences: next_sequence_value()', () => {
  it('1. atomic increment returns (1, formatted string)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_1,
        'test_seq_basic',
      ]);
      expect(res.rows).toHaveLength(1);
      expect(Number(res.rows[0].next_val)).toBe(1);
    });
  });

  it('2. sequential calls produce gap-free values 1..5', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const values: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
          SEED.INSTITUTE_1,
          'test_seq_serial',
        ]);
        values.push(Number(res.rows[0].next_val));
      }
      expect(values).toEqual([1, 2, 3, 4, 5]);
    });
  });

  it('3. 100 concurrent calls produce 100 unique values (no gaps, no duplicates)', async () => {
    // Use separate connections for true concurrency (each gets its own transaction)
    const promises = Array.from({ length: 100 }, async () => {
      const client = await poolerPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE roviq_app');
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
          SEED.INSTITUTE_1,
        ]);
        const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
          SEED.INSTITUTE_1,
          'test_seq_concurrent',
        ]);
        await client.query('COMMIT');
        return Number(res.rows[0].next_val);
      } finally {
        client.release();
      }
    });

    const results = await Promise.all(promises);

    // All values must be unique
    const unique = new Set(results);
    expect(unique.size).toBe(100);

    // Values must be 1..100 (no gaps)
    const sorted = [...results].sort((a, b) => a - b);
    const expected = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(sorted).toEqual(expected);
  });

  it('4. format template: prefix=N-, template={prefix}2025/{value:04d} → N-2025/0001', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_1,
        'test_seq_format',
      ]);
      expect(res.rows[0].formatted).toBe('N-2025/0001');
      expect(Number(res.rows[0].next_val)).toBe(1);
    });
  });

  it('5. BIGINT overflow: handles values beyond 2^31 (INT range)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      // current_value starts at 2^31 - 2 (2_147_483_646), increment crosses INT boundary
      const res1 = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_1,
        'test_seq_bigint',
      ]);
      expect(Number(res1.rows[0].next_val)).toBe(2_147_483_647); // 2^31 - 1 (INT max)

      const res2 = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_1,
        'test_seq_bigint',
      ]);
      expect(Number(res2.rows[0].next_val)).toBe(2_147_483_648); // Beyond INT max — only BIGINT works
    });
  });

  it('6. missing sequence returns 0 rows (empty result, not error)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_1,
        'nonexistent_sequence',
      ]);
      expect(res.rows).toHaveLength(0);
    });
  });
});

describe('tenant_sequences: RLS isolation', () => {
  it('7. tenant A cannot increment tenant B sequence', async () => {
    // Tenant A (INSTITUTE_1) tries to call next_sequence_value on INSTITUTE_2's sequence
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query(`SELECT * FROM next_sequence_value($1, $2)`, [
        SEED.INSTITUTE_2,
        'test_seq_isolation',
      ]);
      // RLS blocks the UPDATE — no matching row visible, so 0 rows returned
      expect(res.rows).toHaveLength(0);
    });

    // Verify the sequence was NOT incremented (still at 0) via superuser
    const check = await superPool.query(
      `SELECT current_value FROM tenant_sequences
       WHERE tenant_id = $1 AND sequence_name = $2`,
      [SEED.INSTITUTE_2, 'test_seq_isolation'],
    );
    expect(Number(check.rows[0].current_value)).toBe(0);
  });

  it('8. roviq_reseller can SELECT but not UPDATE sequences', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': '00000000-0000-0000-0000-000000000001' },
      async (client) => {
        // SELECT should work (reseller can read tenant data)
        const selectRes = await client.query(
          `SELECT * FROM tenant_sequences WHERE sequence_name = $1`,
          ['test_seq_rls_read'],
        );
        expect(selectRes.rows.length).toBeGreaterThanOrEqual(1);

        // UPDATE is blocked at GRANT level — roviq_reseller only has SELECT on tenant_sequences
        const updateErr = await client
          .query(
            `UPDATE tenant_sequences SET current_value = 999
             WHERE tenant_id = $1 AND sequence_name = $2`,
            [SEED.INSTITUTE_1, 'test_seq_rls_read'],
          )
          .catch((e: Error) => e);
        expect(updateErr).toBeInstanceOf(Error);
        expect((updateErr as Error).message).toMatch(/permission denied/i);
      },
    );
  });
});
