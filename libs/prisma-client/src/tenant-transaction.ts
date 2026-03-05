import type { PrismaClient } from './generated/prisma/client';
import { isValidTenantId, tenantContext } from './tenant-extension';

// Custom transaction wrapper that preserves tenant context.
// Prisma's $transaction may use different connections from the pool,
// so we must SET LOCAL inside the transaction itself.
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
    await tx.$executeRawUnsafe('SET LOCAL app.current_tenant_id = $1', ctx.tenantId);
    return fn(tx as unknown as PrismaClient);
  });
}
