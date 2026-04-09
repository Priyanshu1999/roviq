import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, softDelete, withReseller } from '@roviq/database';
import { plans } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
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

  /** ACTIVE → INACTIVE. Blocks new subscriptions but keeps existing ones. */
  async archive(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(plans.id, id), eq(plans.status, 'ACTIVE')))
        .returning();
      if (!plan) {
        billingError('PLAN_NOT_FOUND', 'Active plan not found');
      }
      return plan;
    });
  }

  /** INACTIVE → ACTIVE. Makes plan available for new subscriptions again. */
  async restore(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({ status: 'ACTIVE', updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(plans.id, id), eq(plans.status, 'INACTIVE')))
        .returning();
      if (!plan) {
        billingError('PLAN_NOT_FOUND', 'Archived plan not found');
      }
      return plan;
    });
  }

  async softDelete(resellerId: string, id: string) {
    await withReseller(this.db, resellerId, (tx) => softDelete(tx, plans, id));
  }
}
