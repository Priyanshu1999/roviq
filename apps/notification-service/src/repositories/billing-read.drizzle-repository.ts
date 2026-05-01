import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  i18nDisplay,
  institutes,
  mkAdminCtx,
  users,
  withAdmin,
} from '@roviq/database';
import { plans, subscriptions } from '@roviq/ee-database';
import { eq } from 'drizzle-orm';
import { BillingReadRepository } from './billing-read.repository';
import type { SubscriptionDetails, UserIdRecord } from './types';

@Injectable()
export class BillingReadDrizzleRepository extends BillingReadRepository {
  private readonly logger = new Logger(BillingReadDrizzleRepository.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails | null> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .select({
          subscriptionId: subscriptions.id,
          tenantId: subscriptions.tenantId,
          instituteName: institutes.name,
          planName: plans.name,
          planAmount: plans.amount,
          planCurrency: plans.currency,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .innerJoin(institutes, eq(subscriptions.tenantId, institutes.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      if (!result[0]) {
        this.logger.warn(`Subscription ${subscriptionId} not found for notification`);
        return null;
      }

      const row = result[0];
      return {
        subscriptionId: row.subscriptionId,
        instituteId: row.tenantId,
        instituteName: i18nDisplay(row.instituteName),
        planName: i18nDisplay(row.planName),
        planAmount: Number(row.planAmount),
        planCurrency: row.planCurrency,
      };
    });
  }

  async findPlatformAdminUser(): Promise<UserIdRecord | null> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, 'admin'))
        .limit(1);

      return result[0] ?? null;
    });
  }
}
