import { Inject, Injectable } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, withReseller } from '@roviq/database';
import { gatewayConfigs, payments } from '@roviq/ee-database';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { billingError } from '../billing.errors';

@Injectable()
export class GatewayConfigRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  async findByResellerId(resellerId: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      return tx
        .select()
        .from(gatewayConfigs)
        .where(isNull(gatewayConfigs.deletedAt))
        .orderBy(desc(gatewayConfigs.createdAt));
    });
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [config] = await tx
        .select()
        .from(gatewayConfigs)
        .where(and(eq(gatewayConfigs.id, id), isNull(gatewayConfigs.deletedAt)))
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
      const [config] = await tx
        .update(gatewayConfigs)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(gatewayConfigs.id, id), isNull(gatewayConfigs.deletedAt)))
        .returning();
      return config;
    });
  }

  async softDelete(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      // Check for pending payments referencing this config's provider
      const [config] = await tx
        .select()
        .from(gatewayConfigs)
        .where(and(eq(gatewayConfigs.id, id), isNull(gatewayConfigs.deletedAt)))
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
        .where(and(eq(gatewayConfigs.id, id), isNull(gatewayConfigs.deletedAt)))
        .returning();
      return deleted;
    });
  }
}
