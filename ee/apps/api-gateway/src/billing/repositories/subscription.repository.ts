import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  mkAdminCtx,
  mkResellerCtx,
  withAdmin,
  withReseller,
} from '@roviq/database';
import { plans, subscriptions } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  /** Find active/trialing/paused/past_due subscription for a tenant. Returns null if none. */
  async findActiveByTenant(resellerId: string, tenantId: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [sub] = await tx
        .select({ subscription: subscriptions, plan: plans })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            sql`${subscriptions.status} NOT IN ('CANCELLED', 'EXPIRED')`,
          ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      if (!sub) return null;
      return { ...sub.subscription, plan: sub.plan };
    });
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [sub] = await tx
        .select({ subscription: subscriptions, plan: plans })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.id, id))
        .limit(1);
      if (!sub) return null;
      return { ...sub.subscription, plan: sub.plan };
    });
  }

  async findByResellerId(
    resellerId: string,
    params: { status?: string; first: number; after?: string },
  ) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const conditions: SQL[] = [];
      if (params.status) {
        conditions.push(
          eq(subscriptions.status, params.status as (typeof subscriptions.$inferSelect)['status']),
        );
      }

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: subscriptions.createdAt, id: subscriptions.id })
          .from(subscriptions)
          .where(eq(subscriptions.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${subscriptions.createdAt}, ${subscriptions.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        tx
          .select({
            subscription: subscriptions,
            plan: plans,
            institute: { id: institutes.id, name: institutes.name },
          })
          .from(subscriptions)
          .innerJoin(plans, eq(subscriptions.planId, plans.id))
          .innerJoin(institutes, eq(subscriptions.tenantId, institutes.id))
          .where(where)
          .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
          .limit(params.first),
        tx.select({ total: count() }).from(subscriptions).where(where),
      ]);

      return {
        items: items.map((row) => ({
          ...row.subscription,
          plan: row.plan,
          institute: row.institute,
        })),
        totalCount: total,
      };
    });
  }

  async create(resellerId: string, data: typeof subscriptions.$inferInsert) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [sub] = await tx.insert(subscriptions).values(data).returning();
      const [plan] = await tx.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
      return { ...sub, plan };
    });
  }

  /** Batch count active subscriptions per plan ID (for DataLoader). Uses admin context
   * because this is a cross-plan aggregation — the parent query already filtered by reseller. */
  async countByPlanIds(planIds: string[]): Promise<Map<string, number>> {
    const rows = await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx
        .select({ planId: subscriptions.planId, total: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.planId, planIds),
            sql`${subscriptions.status} IN ('TRIALING', 'ACTIVE', 'PAUSED')`,
          ),
        )
        .groupBy(subscriptions.planId),
    );

    return new Map(rows.map((r) => [r.planId, r.total]));
  }

  async update(resellerId: string, id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [sub] = await tx
        .update(subscriptions)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(subscriptions.id, id))
        .returning();
      return sub;
    });
  }
}
