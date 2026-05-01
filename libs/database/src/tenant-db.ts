import type {
  AuthUser,
  InstituteContext,
  PlatformContext,
  ResellerContext,
} from '@roviq/common-types';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from './providers';

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets `ROLE roviq_app` + `app.current_tenant_id` so RLS policies apply.
 *
 * The branded `InstituteContext` parameter forces callers to narrow the auth
 * union before invoking — preventing platform/reseller contexts from sneaking
 * into a tenant transaction at compile time. Internal callers without a JWT
 * (workflow activities, seeders) must use `mkInstituteCtx(tenantId)`.
 */
export async function withTenant<T>(
  db: DrizzleDB,
  ctx: InstituteContext,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE roviq_app`);
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${ctx.tenantId}, true)`);
    return callback(tx as DrizzleDB);
  });
}

/**
 * Execute a callback with admin role for policy-based RLS bypass.
 * Sets `ROLE roviq_admin` via SET LOCAL inside a transaction.
 */
export async function withAdmin<T>(
  db: DrizzleDB,
  _ctx: PlatformContext,
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
  ctx: ResellerContext,
  callback: (tx: DrizzleDB) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE roviq_reseller`);
    await tx.execute(sql`SELECT set_config('app.current_reseller_id', ${ctx.resellerId}, true)`);
    return callback(tx as DrizzleDB);
  });
}

// Synthetic-context factories for callers without a JWT — workflow activities,
// seeders, internal repositories invoked from event consumers. They mint a
// minimal branded context so the wrapper signatures stay strict at the
// resolver/service entry-point.
const SYNTHETIC_USER_ID = '00000000-0000-0000-0000-000000000000';

const SYNTHETIC_BASE = {
  userId: SYNTHETIC_USER_ID,
  membershipId: SYNTHETIC_USER_ID,
  roleId: SYNTHETIC_USER_ID,
  type: 'access' as const,
} satisfies Pick<AuthUser, 'userId' | 'membershipId' | 'roleId' | 'type'>;

export function mkAdminCtx(): PlatformContext {
  return { ...SYNTHETIC_BASE, _scope: 'platform', scope: 'platform' };
}

export function mkResellerCtx(resellerId: string): ResellerContext {
  return { ...SYNTHETIC_BASE, _scope: 'reseller', scope: 'reseller', resellerId };
}

export function mkInstituteCtx(tenantId: string): InstituteContext {
  return { ...SYNTHETIC_BASE, _scope: 'institute', scope: 'institute', tenantId };
}
