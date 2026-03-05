export { PrismaPg } from '@prisma/adapter-pg';
export type * from './generated/prisma/client';
export { PrismaClient } from './generated/prisma/client';
export {
  createTenantClient,
  isValidTenantId,
  type TenantPrismaClient,
  tenantContext,
} from './tenant-extension';
export { tenantTransaction } from './tenant-transaction';
