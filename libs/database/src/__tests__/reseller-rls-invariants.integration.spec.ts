/**
 * ROV-87 / ROV-89 specific RLS invariants not covered by existing suites.
 *
 * The broad reseller/pooler security invariants already live in:
 *   - security-invariants.integration.spec.ts  (pooler NOINHERIT, is_system flag,
 *                                                cross-reseller isolation)
 *   - institute-rls-invariants.integration.spec.ts  (roviq_reseller positive/negative
 *                                                    read on institutes, DELETE denial)
 *
 * This file covers the two gaps specific to ROV-87:
 *   1. institutes.reseller_id column defaults to the Roviq Direct UUID — ensuring
 *      every institute is owned by a reseller without an explicit FK at insert time.
 *   2. FORCE ROW LEVEL SECURITY on resellers and reseller_memberships — the tables
 *      that use reseller_id (not tenant_id) are excluded from the tenant-sweep in
 *      security-invariants.integration.spec.ts test 20, so we verify them here.
 *
 * Run: pnpm nx test database --testPathPattern=reseller-rls-invariants
 * Requires: seeded DB (pnpm db:reset --seed)
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_SUPERUSER_URL } from './test-helpers';

const RESELLER_DIRECT = '00000000-0000-4000-a000-000000000011';
const INSTITUTE_1 = '00000000-0000-4000-a000-000000000101';
const INSTITUTE_2 = '00000000-0000-4000-a000-000000000102';

const RESELLER_TABLES = ['resellers', 'reseller_memberships'];

let superPool: pg.Pool;

beforeAll(async () => {
  superPool = new pg.Pool({ connectionString: TEST_SUPERUSER_URL, max: 2 });
  const res = await superPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await superPool.end();
});

describe('ROV-87 Invariant A: institutes.reseller_id defaults to Roviq Direct', () => {
  it('every seeded institute has reseller_id = Roviq Direct UUID', async () => {
    const res = await superPool.query(
      `SELECT id, reseller_id
       FROM institutes
       WHERE id = ANY($1::uuid[])`,
      [[INSTITUTE_1, INSTITUTE_2]],
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    for (const row of res.rows) {
      expect(row.reseller_id).toBe(RESELLER_DIRECT);
    }
  });
});

describe('ROV-87 Invariant B: FORCE ROW LEVEL SECURITY on reseller-domain tables', () => {
  it('resellers and reseller_memberships have relforcerowsecurity = true', async () => {
    const res = await superPool.query(
      `SELECT c.relname, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1)
       ORDER BY c.relname`,
      [RESELLER_TABLES],
    );

    const tableMap = new Map(res.rows.map((r) => [r.relname, r.relforcerowsecurity]));

    for (const table of RESELLER_TABLES) {
      expect(tableMap.get(table), `${table} should have FORCE RLS enabled`).toBe(true);
    }
  });
});
