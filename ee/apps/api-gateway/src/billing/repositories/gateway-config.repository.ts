import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, withReseller } from '@roviq/database';
import { gatewayConfigs, gatewayConfigsLive, payments } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq } from 'drizzle-orm';
import { billingError } from '../billing.errors';

@Injectable()
export class GatewayConfigRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  async findByResellerId(resellerId: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      return tx.select().from(gatewayConfigsLive).orderBy(desc(gatewayConfigsLive.createdAt));
    });
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [config] = await tx
        .select()
        .from(gatewayConfigsLive)
        .where(eq(gatewayConfigsLive.id, id))
        .limit(1);
      return config ?? null;
    });
  }

  async create(resellerId: string, data: typeof gatewayConfigs.$inferInsert) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [config] = await tx.insert(gatewayConfigs).values(data).returning();
      return config;
    });
  }

  async update(resellerId: string, id: string, data: Partial<typeof gatewayConfigs.$inferInsert>) {
    return withReseller(this.db, resellerId, async (tx) => {
      // Lookup through the live view to skip soft-deleted rows; the UPDATE
      // itself targets the base table since views are read-only.
      const [existing] = await tx
        .select({ id: gatewayConfigsLive.id })
        .from(gatewayConfigsLive)
        .where(eq(gatewayConfigsLive.id, id))
        .limit(1);
      if (!existing) return undefined;

      const [config] = await tx
        .update(gatewayConfigs)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(gatewayConfigs.id, id))
        .returning();
      return config;
    });
  }

  async softDelete(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [config] = await tx
        .select()
        .from(gatewayConfigsLive)
        .where(eq(gatewayConfigsLive.id, id))
        .limit(1);
      if (!config) billingError('GATEWAY_CONFIG_NOT_FOUND', 'Gateway config not found');

      const [{ pendingCount }] = await tx
        .select({ pendingCount: count() })
        .from(payments)
        .where(
          and(
            eq(payments.resellerId, resellerId),
            eq(payments.gatewayProvider, config.provider),
            eq(payments.status, 'PENDING'),
          ),
        );
      if (pendingCount > 0) {
        billingError(
          'PLAN_IN_USE',
          `Cannot delete gateway config with ${pendingCount} pending payment(s)`,
        );
      }

      const [deleted] = await tx
        .update(gatewayConfigs)
        .set({
          deletedAt: new Date(),
          deletedBy: this.userId,
          updatedAt: new Date(),
          updatedBy: this.userId,
        })
        .where(eq(gatewayConfigs.id, id))
        .returning();
      return deleted;
    });
  }
}
