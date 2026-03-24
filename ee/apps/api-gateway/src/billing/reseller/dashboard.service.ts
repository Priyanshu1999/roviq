import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, withReseller } from '@roviq/database';
import { invoices, plans, subscriptions } from '@roviq/ee-database';
import { and, count, eq, gte } from 'drizzle-orm';

/** Normalize plan interval to monthly factor */
const INTERVAL_MONTHLY_FACTOR: Record<string, number> = {
  /** Monthly plan — 1x per month */
  MONTHLY: 1,
  /** Quarterly plan — ÷3 to get monthly */
  QUARTERLY: 1 / 3,
  /** Semi-annual plan — ÷6 to get monthly */
  SEMI_ANNUAL: 1 / 6,
  /** Annual plan — ÷12 to get monthly */
  ANNUAL: 1 / 12,
};

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async getDashboard(resellerId: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      // MRR: sum of active subscription amounts normalized to monthly
      const activeSubsWithPlans = await tx
        .select({
          amount: plans.amount,
          interval: plans.interval,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.status, 'ACTIVE'));

      let mrr = 0n;
      for (const row of activeSubsWithPlans) {
        const factor = INTERVAL_MONTHLY_FACTOR[row.interval] ?? 1;
        mrr += BigInt(Math.round(Number(row.amount) * factor));
      }

      // Subscriptions by status
      const statusCounts = await tx
        .select({ status: subscriptions.status, count: count() })
        .from(subscriptions)
        .groupBy(subscriptions.status);

      const subscriptionsByStatus: Record<string, number> = {};
      let activeCount = 0;
      for (const row of statusCounts) {
        subscriptionsByStatus[row.status] = row.count;
        if (row.status === 'ACTIVE') activeCount = row.count;
      }

      // Churned in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
      const [{ churned }] = await tx
        .select({ churned: count() })
        .from(subscriptions)
        .where(
          and(eq(subscriptions.status, 'CANCELLED'), gte(subscriptions.cancelledAt, thirtyDaysAgo)),
        );

      const churnRate = activeCount + churned > 0 ? churned / (activeCount + churned) : 0;

      // Overdue invoice count
      const [{ overdue }] = await tx
        .select({ overdue: count() })
        .from(invoices)
        .where(eq(invoices.status, 'OVERDUE'));

      return {
        mrr,
        activeSubscriptions: activeCount,
        churnedLast30Days: churned,
        churnRate: Math.round(churnRate * 10000) / 10000,
        overdueInvoiceCount: overdue,
        subscriptionsByStatus,
      };
    });
  }
}
