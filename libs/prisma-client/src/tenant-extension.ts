import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from './generated/prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTenantId(id: string): boolean {
  return UUID_RE.test(id);
}

export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export function createTenantClient(basePrisma: PrismaClient) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({
          args,
          query,
        }: {
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const ctx = tenantContext.getStore();
          if (!ctx?.tenantId) {
            throw new Error('Tenant context is not set. Wrap your request in tenantContext.run().');
          }

          if (!UUID_RE.test(ctx.tenantId)) {
            throw new Error('Invalid tenant ID format');
          }

          await basePrisma.$executeRawUnsafe('SET LOCAL app.current_tenant_id = $1', ctx.tenantId);

          return query(args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
