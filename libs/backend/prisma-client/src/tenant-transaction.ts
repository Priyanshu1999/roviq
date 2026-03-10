import type { PrismaClient } from './generated/prisma/client';
import { isValidTenantId, tenantContext } from './tenant-extension';

// Custom transaction wrapper that preserves tenant context.
// Prisma's $transaction may use different connections from the pool,
// so we must SET LOCAL inside the transaction itself.
//
// IMPORTANT: Pass the BASE PrismaClient here, NOT an extended tenant client.
// If an extended client is passed, each query inside `fn` will go through the
// extension's own $transaction([setConfig, query]) wrapper. Due to a known
// Prisma limitation, that inner $transaction runs on a SEPARATE connection,
// which means queries execute outside this transaction's boundary — breaking
// atomicity (though RLS still works since each query sets its own config).
//
// Correct usage:
//   await tenantTransaction(basePrisma, async (tx) => { ... });
// Wrong:
//   await tenantTransaction(tenantPrisma, async (tx) => { ... });
export async function tenantTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  const ctx = tenantContext.getStore();
  if (!ctx?.tenantId) {
    throw new Error('Tenant context is not set.');
  }

  if (!isValidTenantId(ctx.tenantId)) {
    throw new Error('Invalid tenant ID format');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      ctx.tenantId,
    );
    return fn(tx as unknown as PrismaClient);
  });
}
