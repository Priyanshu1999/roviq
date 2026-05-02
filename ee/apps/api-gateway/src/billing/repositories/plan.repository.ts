import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  mkResellerCtx,
  softDelete,
  withReseller,
} from '@roviq/database';
import { plans, plansLive } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq, type SQL, sql } from 'drizzle-orm';
import { billingError } from '../billing.errors';

@Injectable()
export class PlanRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
      const [plan] = await tx.select().from(plansLive).where(eq(plansLive.id, id)).limit(1);
      return plan ?? null;
    });
  }

  async findByCode(resellerId: string, code: string) {
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
      const [plan] = await tx.select().from(plansLive).where(eq(plansLive.code, code)).limit(1);
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
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
      const conditions: SQL[] = [];
      if (params.status) {
        conditions.push(
          eq(plansLive.status, params.status as (typeof plans.$inferSelect)['status']),
        );
      }

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: plansLive.createdAt, id: plansLive.id })
          .from(plansLive)
          .where(eq(plansLive.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${plansLive.createdAt}, ${plansLive.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        tx
          .select()
          .from(plansLive)
          .where(where)
          .orderBy(desc(plansLive.createdAt), desc(plansLive.id))
          .limit(params.first),
        tx.select({ total: count() }).from(plansLive).where(where),
      ]);

      return { items, totalCount: total };
    });
  }

  async create(resellerId: string, data: typeof plans.$inferInsert) {
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
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
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
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
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
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
    return withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), async (tx) => {
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
    await withReseller(this.db, mkResellerCtx(resellerId, 'repository:plan'), (tx) =>
      softDelete(tx, plans, id),
    );
  }
}
