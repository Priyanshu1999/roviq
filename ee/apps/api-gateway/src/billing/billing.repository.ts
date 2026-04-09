import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type AppAbility } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, institutes, withAdmin } from '@roviq/database';
import { gatewayConfigs, invoices, payments, plans, subscriptions } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq, gte, isNull, lte, type SQL, sql } from 'drizzle-orm';

// TODO: Phase 4 — replace with proper CASL-to-Drizzle adapter (@roviq/casl-drizzle)
// For now, CASL ability filtering is a no-op. The RLS policies still enforce tenant isolation.
function _abilityFilter(_ability?: AppAbility, _action?: string): SQL | undefined {
  return undefined;
}

@Injectable()
export class BillingRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  // ---------------------------------------------------------------------------
  // Plans
  // ---------------------------------------------------------------------------

  async createPlan(data: typeof plans.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx.insert(plans).values(data).returning();
      return plan;
    });
  }

  async updatePlan(id: string, data: Partial<typeof plans.$inferInsert>) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
        .returning();
      return plan;
    });
  }

  async findAllPlans(_ability?: AppAbility) {
    return withAdmin(this.db, async (tx) => {
      return tx.select().from(plans).where(isNull(plans.deletedAt)).orderBy(desc(plans.createdAt));
    });
  }

  async findPlanById(id: string, _ability?: AppAbility): Promise<typeof plans.$inferSelect | null> {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .select()
        .from(plans)
        .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
        .limit(1);
      return plan ?? null;
    });
  }

  async archivePlan(id: string) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
        .returning();
      return plan;
    });
  }

  async restorePlan(id: string) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .update(plans)
        .set({ status: 'ACTIVE', updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
        .returning();
      return plan;
    });
  }

  async findPlanWithSubscriptionCount(id: string) {
    return withAdmin(this.db, async (tx) => {
      const [result] = await tx
        .select({ activeSubscriptionCount: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.planId, id),
            sql`${subscriptions.status} NOT IN ('CANCELLED', 'EXPIRED')`,
          ),
        );
      return { activeSubscriptionCount: result?.activeSubscriptionCount ?? 0 };
    });
  }

  // ---------------------------------------------------------------------------
  // Subscriptions (financial records — never soft-deleted, status-driven)
  // ---------------------------------------------------------------------------

  async createSubscription(data: typeof subscriptions.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx.insert(subscriptions).values(data).returning();
      const [plan] = await tx.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
      return { ...sub, plan };
    });
  }

  async updateSubscription(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx
        .update(subscriptions)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(subscriptions.id, id))
        .returning();
      return sub;
    });
  }

  async updateSubscriptionWithPlan(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx
        .update(subscriptions)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(subscriptions.id, id))
        .returning();
      const [plan] = await tx.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
      return { ...sub, plan };
    });
  }

  async findSubscriptionById(id: string, _ability?: AppAbility) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
      return sub ?? null;
    });
  }

  async findSubscriptionByInstitute(instituteId: string, _ability?: AppAbility) {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select({ subscription: subscriptions, plan: plans })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.tenantId, instituteId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      if (!rows[0]) return null;
      return { ...rows[0].subscription, plan: rows[0].plan };
    });
  }

  async findSubscriptionByProviderId(gatewaySubscriptionId: string) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.gatewaySubscriptionId, gatewaySubscriptionId))
        .limit(1);
      return sub ?? null;
    });
  }

  async findAllSubscriptions(params: {
    filter?: { status?: (typeof subscriptions.$inferSelect)['status'] };
    first: number;
    after?: string;
    ability?: AppAbility;
  }) {
    return withAdmin(this.db, async (tx) => {
      const conditions: SQL[] = [];
      if (params.filter?.status) {
        conditions.push(eq(subscriptions.status, params.filter.status));
      }

      // Composite cursor: (createdAt, id) for stable DESC pagination
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

  // ---------------------------------------------------------------------------
  // Invoices (financial records — never soft-deleted, status-driven)
  // ---------------------------------------------------------------------------

  async createInvoice(data: typeof invoices.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [invoice] = await tx.insert(invoices).values(data).returning();
      return invoice;
    });
  }

  async findInvoiceByGatewayPaymentId(
    gatewayPaymentId: string,
  ): Promise<typeof invoices.$inferSelect | null> {
    return withAdmin(this.db, async (tx) => {
      // Look up invoice via the payments table
      const [result] = await tx
        .select({ invoice: invoices })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
        .limit(1);
      return result?.invoice ?? null;
    });
  }

  async findInvoices(params: {
    instituteId?: string;
    filter?: {
      status?: (typeof invoices.$inferSelect)['status'];
      from?: Date;
      to?: Date;
    };
    first: number;
    after?: string;
    ability?: AppAbility;
  }) {
    return withAdmin(this.db, async (tx) => {
      const conditions: SQL[] = [];
      if (params.instituteId) {
        conditions.push(eq(invoices.tenantId, params.instituteId));
      }
      if (params.filter?.status) {
        conditions.push(eq(invoices.status, params.filter.status));
      }
      if (params.filter?.from) {
        conditions.push(gte(invoices.createdAt, params.filter.from));
      }
      if (params.filter?.to) {
        conditions.push(lte(invoices.createdAt, params.filter.to));
      }

      // Composite cursor for stable DESC pagination
      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: invoices.createdAt, id: invoices.id })
          .from(invoices)
          .where(eq(invoices.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${invoices.createdAt}, ${invoices.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        tx
          .select({
            invoice: invoices,
            subscription: {
              id: subscriptions.id,
              tenantId: subscriptions.tenantId,
            },
            institute: { id: institutes.id, name: institutes.name },
          })
          .from(invoices)
          .innerJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
          .innerJoin(institutes, eq(subscriptions.tenantId, institutes.id))
          .where(where)
          .orderBy(desc(invoices.createdAt), desc(invoices.id))
          .limit(params.first),
        tx.select({ total: count() }).from(invoices).where(where),
      ]);

      return {
        items: items.map((row) => ({
          ...row.invoice,
          subscription: { id: row.subscription.id, institute: row.institute },
        })),
        totalCount: total,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Payment Infrastructure
  // ---------------------------------------------------------------------------

  async upsertGatewayConfig(resellerId: string, provider: string) {
    const actorId = this.userId;
    return withAdmin(this.db, async (tx) => {
      const [config] = await tx
        .insert(gatewayConfigs)
        .values({ resellerId, provider, createdBy: actorId, updatedBy: actorId })
        .onConflictDoUpdate({
          target: [gatewayConfigs.resellerId, gatewayConfigs.provider],
          set: {
            updatedAt: new Date(),
            updatedBy: actorId,
            deletedAt: null,
            deletedBy: null,
          },
        })
        .returning();
      return config;
    });
  }

  async findInstituteById(id: string) {
    return withAdmin(this.db, async (tx) => {
      const [institute] = await tx
        .select()
        .from(institutes)
        .where(and(eq(institutes.id, id), isNull(institutes.deletedAt)))
        .limit(1);
      if (!institute) throw new NotFoundException(`Institute ${id} not found`);
      return institute;
    });
  }

  async findAllInstitutes() {
    return withAdmin(this.db, async (tx) => {
      return tx
        .select({ id: institutes.id, name: institutes.name })
        .from(institutes)
        .where(isNull(institutes.deletedAt))
        .orderBy(institutes.name);
    });
  }

  // ---------------------------------------------------------------------------
  // Payments (immutable webhook claims + payment records)
  // ---------------------------------------------------------------------------

  async findPaymentByGatewayId(gatewayPaymentId: string) {
    return withAdmin(this.db, async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
        .limit(1);
      return payment ?? null;
    });
  }

  async createPayment(data: typeof payments.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [payment] = await tx.insert(payments).values(data).returning();
      return payment;
    });
  }

  async claimPaymentEvent(
    gatewayPaymentId: string,
    data: {
      invoiceId: string;
      tenantId: string;
      resellerId: string;
      method: (typeof payments.$inferSelect)['method'];
      amountPaise: bigint;
      currency?: string;
      gatewayProvider?: string;
    },
  ): Promise<boolean> {
    try {
      await withAdmin(this.db, async (tx) => {
        await tx.insert(payments).values({
          ...data,
          gatewayPaymentId,
          status: 'PENDING',
          createdBy: this.userId,
          updatedBy: this.userId,
        });
      });
      return true;
    } catch (error) {
      // 23505 = unique_violation in PostgreSQL
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        return false;
      }
      throw error;
    }
  }

  async markPaymentSucceeded(
    gatewayPaymentId: string,
    data: {
      paidAt?: Date;
    },
  ): Promise<void> {
    await withAdmin(this.db, async (tx) => {
      await tx
        .update(payments)
        .set({
          status: 'SUCCEEDED',
          paidAt: data.paidAt ?? new Date(),
          updatedBy: this.userId,
          updatedAt: new Date(),
        })
        .where(eq(payments.gatewayPaymentId, gatewayPaymentId));
    });
  }
}
