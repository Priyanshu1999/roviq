/**
 * Integration test: verify roviq_reseller has correct GRANTs on billing tables.
 *
 * These tables are managed by resellers via withReseller() which sets
 * SET LOCAL ROLE roviq_reseller. Without proper GRANTs, all write
 * operations fail with "permission denied for table X".
 *
 * Bug: plans, subscriptions, invoices, payments only had SELECT for
 * roviq_reseller — broke create plan, assign subscription, record payment.
 * Fix: migration 20260405093000_fix-reseller-billing-grants
 */

import pg from 'pg';
import { describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL_MIGRATE;

describe('reseller billing GRANTs', () => {
  /**
   * Helper: query the information_schema to check what privileges
   * roviq_reseller has on a given table.
   */
  async function getResellerGrants(tableName: string): Promise<string[]> {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query(
        `SELECT privilege_type FROM information_schema.table_privileges
         WHERE grantee = 'roviq_reseller' AND table_name = $1
         ORDER BY privilege_type`,
        [tableName],
      );
      return result.rows.map((r: { privilege_type: string }) => r.privilege_type);
    } finally {
      await client.end();
    }
  }

  it('plans: reseller has INSERT, UPDATE, DELETE, SELECT', async () => {
    const grants = await getResellerGrants('plans');
    expect(grants).toContain('SELECT');
    expect(grants).toContain('INSERT');
    expect(grants).toContain('UPDATE');
    expect(grants).toContain('DELETE');
  });

  it('subscriptions: reseller has INSERT, UPDATE, SELECT', async () => {
    const grants = await getResellerGrants('subscriptions');
    expect(grants).toContain('SELECT');
    expect(grants).toContain('INSERT');
    expect(grants).toContain('UPDATE');
  });

  it('invoices: reseller has INSERT, UPDATE, SELECT', async () => {
    const grants = await getResellerGrants('invoices');
    expect(grants).toContain('SELECT');
    expect(grants).toContain('INSERT');
    expect(grants).toContain('UPDATE');
  });

  it('payments: reseller has INSERT, UPDATE, SELECT', async () => {
    const grants = await getResellerGrants('payments');
    expect(grants).toContain('SELECT');
    expect(grants).toContain('INSERT');
    expect(grants).toContain('UPDATE');
  });

  it('payment_gateway_configs: reseller has full CRUD', async () => {
    const grants = await getResellerGrants('payment_gateway_configs');
    expect(grants).toContain('SELECT');
    expect(grants).toContain('INSERT');
    expect(grants).toContain('UPDATE');
    expect(grants).toContain('DELETE');
  });
});
