import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type AppAbility, getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  invoices,
  paymentEvents,
  paymentGatewayConfigs,
  subscriptionPlans,
  subscriptions,
  withAdmin,
} from '@roviq/database';
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

  async createPlan(data: typeof subscriptionPlans.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx.insert(subscriptionPlans).values(data).returning();
      return plan;
    });
  }

  async updatePlan(id: string, data: Partial<typeof subscriptionPlans.$inferInsert>) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .update(subscriptionPlans)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(and(eq(subscriptionPlans.id, id), isNull(subscriptionPlans.deletedAt)))
        .returning();
      return plan;
    });
  }

  async findAllPlans(_ability?: AppAbility) {
    return withAdmin(this.db, async (tx) => {
      return tx
        .select()
        .from(subscriptionPlans)
        .where(isNull(subscriptionPlans.deletedAt))
        .orderBy(desc(subscriptionPlans.createdAt));
    });
  }

  async findPlanById(id: string, _ability?: AppAbility) {
    return withAdmin(this.db, async (tx) => {
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.id, id), isNull(subscriptionPlans.deletedAt)))
        .limit(1);
      return plan ?? null;
    });
  }

  // ---------------------------------------------------------------------------
  // Subscriptions (financial records — never soft-deleted, status-driven)
  // ---------------------------------------------------------------------------

  async createSubscription(data: typeof subscriptions.$inferInsert) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx.insert(subscriptions).values(data).returning();
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, sub.planId))
        .limit(1);
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
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, sub.planId))
        .limit(1);
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
        .select()
        .from(subscriptions)
        .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.instituteId, instituteId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      if (!rows[0]) return null;
      return { ...rows[0].subscriptions, plan: rows[0].subscription_plans };
    });
  }

  async findSubscriptionByProviderId(providerSubscriptionId: string) {
    return withAdmin(this.db, async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
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
            plan: subscriptionPlans,
            institute: { id: institutes.id, name: institutes.name },
          })
          .from(subscriptions)
          .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
          .innerJoin(institutes, eq(subscriptions.instituteId, institutes.id))
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

  async findInvoiceByProviderPaymentId(providerPaymentId: string) {
    return withAdmin(this.db, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.providerPaymentId, providerPaymentId))
        .limit(1);
      return invoice ?? null;
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
        conditions.push(eq(invoices.instituteId, params.instituteId));
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
              instituteId: subscriptions.instituteId,
            },
            institute: { id: institutes.id, name: institutes.name },
          })
          .from(invoices)
          .innerJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
          .innerJoin(institutes, eq(subscriptions.instituteId, institutes.id))
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

  async upsertGatewayConfig(
    instituteId: string,
    provider: (typeof paymentGatewayConfigs.$inferSelect)['provider'],
  ) {
    const actorId = this.userId;
    return withAdmin(this.db, async (tx) => {
      const [config] = await tx
        .insert(paymentGatewayConfigs)
        .values({ instituteId: instituteId, provider, createdBy: actorId, updatedBy: actorId })
        .onConflictDoUpdate({
          target: paymentGatewayConfigs.instituteId,
          set: {
            provider,
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
  // Events (immutable — no updatedBy needed)
  // ---------------------------------------------------------------------------

  async findPaymentEvent(providerEventId: string) {
    return withAdmin(this.db, async (tx) => {
      const [event] = await tx
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.providerEventId, providerEventId))
        .limit(1);
      return event ?? null;
    });
  }

  async upsertPaymentEvent(data: {
    provider: (typeof paymentEvents.$inferSelect)['provider'];
    eventType: string;
    providerEventId: string;
    subscriptionId?: string | null;
    instituteId?: string | null;
    payload: Record<string, unknown>;
    processedAt: Date;
  }) {
    return withAdmin(this.db, async (tx) => {
      const [event] = await tx
        .insert(paymentEvents)
        .values({
          provider: data.provider,
          eventType: data.eventType,
          providerEventId: data.providerEventId,
          subscriptionId: data.subscriptionId,
          instituteId: data.instituteId,
          payload: data.payload,
          processedAt: data.processedAt,
        })
        .onConflictDoUpdate({
          target: paymentEvents.providerEventId,
          set: { processedAt: data.processedAt },
        })
        .returning();
      return event;
    });
  }

  async claimPaymentEvent(
    providerEventId: string,
    data: {
      provider: (typeof paymentEvents.$inferSelect)['provider'];
      eventType: string;
      payload: Record<string, unknown>;
    },
  ): Promise<boolean> {
    try {
      await withAdmin(this.db, async (tx) => {
        await tx.insert(paymentEvents).values({
          providerEventId,
          provider: data.provider,
          eventType: data.eventType,
          payload: data.payload,
        });
      });
      return true;
    } catch (error) {
      // 23505 = unique_violation in PostgreSQL (equivalent to Prisma P2002)
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

  async markPaymentEventProcessed(
    providerEventId: string,
    data: {
      subscriptionId?: string;
      instituteId?: string;
    },
  ): Promise<void> {
    await withAdmin(this.db, async (tx) => {
      await tx
        .update(paymentEvents)
        .set({ ...data, processedAt: new Date() })
        .where(eq(paymentEvents.providerEventId, providerEventId));
    });
  }
}
