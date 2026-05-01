import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, institutes, mkAdminCtx, withAdmin } from '@roviq/database';
import { subscriptions } from '@roviq/ee-database';
import { pubSub } from '@roviq/pubsub';
import { eq } from 'drizzle-orm';

/** Typed payload for billing domain events that carry a tenantId */
interface BillingTenantEvent {
  tenantId: string;
  subscriptionId?: string;
  reason?: string;
}

/**
 * In-process event consumer for billing → institute lifecycle integration.
 * Listens to PubSub events (same process) emitted by billing services.
 */
@Injectable()
export class BillingEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(BillingEventConsumer.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  onModuleInit() {
    // subscription.cancelled/expired → suspend institute
    for (const event of ['BILLING.subscription.cancelled', 'BILLING.subscription.expired']) {
      pubSub.subscribe(event, (data: BillingTenantEvent) => {
        const tenantId = String(data.tenantId ?? '');
        if (!tenantId) return;
        withAdmin(this.db, mkAdminCtx(), async (tx) => {
          await tx
            .update(institutes)
            .set({ status: 'SUSPENDED', updatedAt: new Date() })
            .where(eq(institutes.id, tenantId));
        })
          .then(() => this.logger.log(`Institute ${tenantId} suspended (${event})`))
          .catch((err) =>
            this.logger.error(`Failed to suspend ${tenantId}`, (err as Error).message),
          );
      });
    }

    // invoice.paid on past_due → reactivate (ROV-127: fires only when fully paid)
    pubSub.subscribe('BILLING.invoice.paid', (data: BillingTenantEvent) => {
      const tenantId = String(data.tenantId ?? '');
      if (!tenantId) return;
      withAdmin(this.db, mkAdminCtx(), async (tx) => {
        const [sub] = await tx
          .select({ status: subscriptions.status })
          .from(subscriptions)
          .where(eq(subscriptions.tenantId, tenantId))
          .limit(1);
        if (sub?.status === 'PAST_DUE') {
          await tx
            .update(subscriptions)
            .set({ status: 'ACTIVE', updatedAt: new Date() })
            .where(eq(subscriptions.tenantId, tenantId));
          await tx
            .update(institutes)
            .set({ status: 'ACTIVE', updatedAt: new Date() })
            .where(eq(institutes.id, tenantId));
          this.logger.log(`Institute ${tenantId} reactivated`);
        }
      }).catch((err) =>
        this.logger.error(`Failed to reactivate ${tenantId}`, (err as Error).message),
      );
    });

    // subscription.paused → log
    pubSub.subscribe('BILLING.subscription.paused', (data: BillingTenantEvent) => {
      const tenantId = String(data.tenantId ?? '');
      if (tenantId) this.logger.log(`Subscription paused for ${tenantId}`);
    });
  }
}
