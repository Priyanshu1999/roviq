import { Inject, Injectable } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, withReseller } from '@roviq/database';
import { plans, subscriptions } from '@roviq/ee-database';
import { and, count, desc, eq, isNull, type SQL, sql } from 'drizzle-orm';
import { billingError } from '../billing.errors';

@Injectable()
export class PlanRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx.select().from(plans).where(eq(plans.id, id)).limit(1);
      return plan ?? null;
    });
  }

  async findByCode(resellerId: string, code: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx
        .select()
        .from(plans)
        .where(and(eq(plans.code, code), isNull(plans.deletedAt)))
        .limit(1);
      return plan ?? null;
    });
  }

  async findByResellerId(
    resellerId: string,
    params: {
      status?: string;
      first: number;
      after?: string;
    },
  ) {
    return withReseller(this.db, resellerId, async (tx) => {
      const conditions: SQL[] = [];
      if (params.status) {
        conditions.push(eq(plans.status, params.status as (typeof plans.$inferSelect)['status']));
      }

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: plans.createdAt, id: plans.id })
          .from(plans)
          .where(eq(plans.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${plans.createdAt}, ${plans.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        tx
          .select()
          .from(plans)
          .where(where)
          .orderBy(desc(plans.createdAt), desc(plans.id))
          .limit(params.first),
        tx.select({ total: count() }).from(plans).where(where),
      ]);

      return { items, totalCount: total };
    });
  }

  async create(resellerId: string, data: typeof plans.$inferInsert) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx.insert(plans).values(data).returning();
      return plan;
    });
  }

  async update(
    resellerId: string,
    id: string,
    data: Partial<typeof plans.$inferInsert>,
    expectedVersion: number,
  ) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({
          ...data,
          version: expectedVersion + 1,
          updatedAt: new Date(),
          updatedBy: this.userId,
        })
        .where(and(eq(plans.id, id), eq(plans.version, expectedVersion)))
        .returning();
      if (!plan) {
        billingError(
          'CONCURRENT_MODIFICATION',
          'Plan was modified by another request. Refresh and try again.',
        );
      }
      return plan;
    });
  }

  async softDelete(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      // Check for active subscriptions
      const [{ activeCount }] = await tx
        .select({ activeCount: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.planId, id),
            sql`${subscriptions.status} NOT IN ('CANCELLED', 'EXPIRED')`,
          ),
        );
      if (activeCount > 0) {
        billingError(
          'PLAN_IN_USE',
          `Cannot delete plan with ${activeCount} active subscription(s)`,
        );
      }

      const [plan] = await tx
        .update(plans)
        .set({
          deletedAt: new Date(),
          deletedBy: this.userId,
          updatedAt: new Date(),
          updatedBy: this.userId,
        })
        .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
        .returning();
      if (!plan) {
        billingError('PLAN_NOT_FOUND', 'Plan not found');
      }
      return plan;
    });
  }
}
