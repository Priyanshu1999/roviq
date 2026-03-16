import { sql } from 'drizzle-orm';
import type { DrizzleDB } from './providers';

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets `app.current_tenant_id` via SET LOCAL so RLS policies apply.
 */
export async function withTenant<T>(
  db: DrizzleDB,
  tenantId: string,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return callback(tx as DrizzleDB);
  });
}

/**
 * Execute a callback with admin role for policy-based RLS bypass.
 * Sets `ROLE roviq_admin` via SET LOCAL inside a transaction.
 */
export async function withAdmin<T>(
  db: DrizzleDB,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE roviq_admin`);
    return callback(tx as DrizzleDB);
  });
}

/**
 * Execute a callback with tenant context + trash view (sees deleted rows).
 * Sets both `app.current_tenant_id` and `app.include_deleted=true`.
 */
export async function withTrash<T>(
  db: DrizzleDB,
  tenantId: string,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    return callback(tx as DrizzleDB);
  });
}
