import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, institutes, withAdmin } from '@roviq/database';
import { subscriptions } from '@roviq/ee-database';
import { pubSub } from '@roviq/pubsub';
import { eq } from 'drizzle-orm';

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
      pubSub.subscribe(event, (data: Record<string, unknown>) => {
        const tenantId = String(data['tenantId'] ?? '');
        if (!tenantId) return;
        withAdmin(this.db, async (tx) => {
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

    // payment.succeeded on past_due → reactivate
    pubSub.subscribe('BILLING.payment.succeeded', (data: Record<string, unknown>) => {
      const tenantId = String(data['tenantId'] ?? '');
      if (!tenantId) return;
      withAdmin(this.db, async (tx) => {
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
    pubSub.subscribe('BILLING.subscription.paused', (data: Record<string, unknown>) => {
      const tenantId = String(data['tenantId'] ?? '');
      if (tenantId) this.logger.log(`Subscription paused for ${tenantId}`);
    });
  }
}
