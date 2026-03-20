import { sql } from 'drizzle-orm';
import type { DrizzleDB } from './providers';

/** Set tenant context in a single round trip */
async function setTenantContext(tx: DrizzleDB, tenantId: string) {
  await tx.execute(
    sql`SET LOCAL ROLE roviq_app; SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
  );
}

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets `ROLE roviq_app` + `app.current_tenant_id` so RLS policies apply.
 */
export async function withTenant<T>(
  db: DrizzleDB,
  tenantId: string,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, tenantId);
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
 * Execute a callback within a reseller-scoped transaction.
 * Sets `ROLE roviq_reseller` + `app.current_reseller_id` so RLS policies apply.
 */
export async function withReseller<T>(
  db: DrizzleDB,
  resellerId: string,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL ROLE roviq_reseller; SELECT set_config('app.current_reseller_id', ${resellerId}, true)`,
    );
    return callback(tx as DrizzleDB);
  });
}

/**
 * Execute a callback with tenant context + trash view (sees deleted rows).
 * Sets `ROLE roviq_app`, `app.current_tenant_id`, and `app.include_deleted=true`.
 */
export async function withTrash<T>(
  db: DrizzleDB,
  tenantId: string,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, tenantId);
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    return callback(tx as DrizzleDB);
  });
}
