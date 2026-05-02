import { Inject, Injectable } from '@nestjs/common';
import type { FeatureLimits, SubscriptionReader } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, mkAdminCtx, withAdmin } from '@roviq/database';
import { plans, subscriptions } from '@roviq/ee-database';
import { and, desc, eq, sql } from 'drizzle-orm';

/**
 * EE implementation of SubscriptionReader.
 * Queries subscriptions + plans via withAdmin() (needs cross-tenant access for entitlement checks).
 */
@Injectable()
export class SubscriptionReaderImpl implements SubscriptionReader {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findActiveByTenant(
    tenantId: string,
  ): Promise<{ plan: { entitlements: FeatureLimits } } | null> {
    return withAdmin(this.db, mkAdminCtx('service:subscription-reader'), async (tx) => {
      const [row] = await tx
        .select({
          planEntitlements: plans.entitlements,
        })
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

      if (!row) return null;

      return {
        plan: { entitlements: row.planEntitlements as FeatureLimits },
      };
    });
  }
}
