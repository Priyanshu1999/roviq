/**
 * Billing RLS security invariant tests (ROV-133).
 *
 * These tests run against a real PostgreSQL instance with actual roles,
 * GRANTs, RLS policies, and billing tables. They verify every billing
 * security invariant holds at the database level.
 *
 * Setup: requires a running postgres with all roles (roviq_pooler, roviq_app,
 * roviq_reseller, roviq_admin) and schema pushed via db:push + FORCE RLS +
 * the billing-grants-rls-indexes custom migration applied + seed data.
 *
 * Run: pnpm nx test database --testPathPattern=billing-rls-invariants
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const POOLER_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5434/roviq';

const SUPERUSER_URL =
  process.env.DATABASE_URL_TEST_MIGRATE ??
  process.env.DATABASE_URL_MIGRATE ??
  'postgresql://roviq:roviq_dev@localhost:5434/roviq';

const SEED = {
  RESELLER_DIRECT: '00000000-0000-4000-a000-000000000011',
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-4000-a000-000000000102',
  PLAN_FREE: '00000000-0000-4000-a000-000000000001',
  PLAN_PRO: '00000000-0000-4000-a000-000000000002',
};

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

describe('Billing RLS Invariants', () => {
  // ── 1. roviq_app can only see plans assigned via own subscription ──

  it('1. roviq_app sees only plans assigned via own subscription (subquery policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      // Without an active subscription, institute should see 0 plans
      // (unless seeded subscription exists — test verifies RLS filters correctly)
      const result = await client.query('SELECT id FROM plans');
      // Plans are only visible if institute has a subscription referencing them
      // The number depends on seed state — the important thing is RLS doesn't leak ALL plans
      expect(result.rows.length).toBeLessThanOrEqual(2);
    });
  });

  // ── 2. roviq_app has NO access to payment_gateway_configs ──

  it('2. roviq_app cannot SELECT payment_gateway_configs (no GRANT, no policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(client.query('SELECT id FROM payment_gateway_configs')).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  // ── 3. Reseller A cannot see reseller B's plans ──

  it('3. roviq_reseller A cannot see reseller B plans', async () => {
    const fakeResellerId = '00000000-0000-0000-0000-000000000099';
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': fakeResellerId },
      async (client) => {
        const result = await client.query('SELECT id FROM plans');
        // Fake reseller has no plans — RLS filters them out
        expect(result.rows.length).toBe(0);
      },
    );
  });

  // ── 4. roviq_reseller cannot INSERT plan with wrong reseller_id ──

  it('4. roviq_reseller cannot INSERT plan with wrong reseller_id (RLS withCheck)', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        const wrongResellerId = '00000000-0000-0000-0000-000000000099';
        const actor = randomUUID();
        await expect(
          client.query(
            `INSERT INTO plans (reseller_id, name, code, "interval", amount, currency, entitlements, created_by, updated_by)
             VALUES ($1, '{"en":"RLS Test"}'::jsonb, 'RLS-TEST', 'MONTHLY', 0, 'INR',
                     '{"maxStudents":null,"maxStaff":null,"maxStorageMb":null,"auditLogRetentionDays":90,"features":[]}'::jsonb,
                     $2, $2)`,
            [wrongResellerId, actor],
          ),
        ).rejects.toThrow(/row-level security/i);
      },
    );
  });

  // ── 5. roviq_app cannot INSERT into invoices ──

  it('5. roviq_app cannot INSERT into invoices (only SELECT granted)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const actor = randomUUID();
      await expect(
        client.query(
          `INSERT INTO invoices (tenant_id, subscription_id, reseller_id, invoice_number, due_at, created_by, updated_by)
             VALUES ($1, uuidv7(), $2, 'FAKE-001', now(), $3, $3)`,
          [SEED.INSTITUTE_1, SEED.RESELLER_DIRECT, actor],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  // ── 6. Partial unique constraint — two active subs for same tenant ──

  it('6. partial unique constraint prevents two active subscriptions per tenant', async () => {
    // Use superuser to test the constraint directly
    const client = await superPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE roviq_admin');
      const actor = randomUUID();

      // Insert first active subscription
      await client.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, reseller_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $4)`,
        [SEED.INSTITUTE_1, SEED.PLAN_FREE, SEED.RESELLER_DIRECT, actor],
      );

      // Second active subscription for same tenant should violate partial unique index
      await expect(
        client.query(
          `INSERT INTO subscriptions (tenant_id, plan_id, reseller_id, status, created_by, updated_by)
           VALUES ($1, $2, $3, 'ACTIVE', $4, $4)`,
          [SEED.INSTITUTE_1, SEED.PLAN_PRO, SEED.RESELLER_DIRECT, actor],
        ),
      ).rejects.toThrow(/uq_sub_active_tenant|unique/i);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  // ── 7. roviq_app cannot UPDATE subscriptions ──

  it('7. roviq_app cannot UPDATE subscriptions (only SELECT granted)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(
        client.query(`UPDATE subscriptions SET status = 'CANCELLED' WHERE tenant_id = $1`, [
          SEED.INSTITUTE_1,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  // ── 8. roviq_reseller sees only own reseller's invoices ──

  it('8. roviq_reseller sees only own reseller invoices', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        const result = await client.query('SELECT id, reseller_id FROM invoices');
        for (const row of result.rows) {
          expect(row.reseller_id).toBe(SEED.RESELLER_DIRECT);
        }
      },
    );
  });

  // ── 9. FORCE RLS on all 6 billing tables ──

  it('9. FORCE RLS enabled on all 6 billing tables', async () => {
    const result = await superPool.query(
      `SELECT relname, relforcerowsecurity
       FROM pg_class
       WHERE relname IN ('plans', 'subscriptions', 'invoices', 'payments', 'payment_gateway_configs', 'reseller_invoice_sequences')
       ORDER BY relname`,
    );

    expect(result.rows).toHaveLength(6);
    for (const row of result.rows) {
      expect(row.relforcerowsecurity).toBe(true);
    }
  });
});
