import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pubSub } from '@roviq/pubsub';
import { REDIS_CLIENT } from '@roviq/redis';
import type { Redis } from 'ioredis';

/** Typed payload for billing events that carry a tenantId */
interface BillingTenantEvent {
  tenantId: string;
}

const CACHE_PREFIX = 'entitlements:';

/**
 * In-process PubSub consumer that invalidates entitlement cache on subscription changes.
 */
@Injectable()
export class EntitlementCacheConsumer implements OnModuleInit {
  private readonly logger = new Logger(EntitlementCacheConsumer.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit() {
    for (const event of [
      'BILLING.subscription.plan_changed',
      'BILLING.subscription.cancelled',
      'BILLING.subscription.expired',
    ]) {
      pubSub.subscribe(event, (data: BillingTenantEvent) => {
        const tenantId = String(data.tenantId ?? '');
        if (tenantId) {
          this.redis
            .del(`${CACHE_PREFIX}${tenantId}`)
            .then(() => this.logger.debug(`Cache invalidated for ${tenantId} on ${event}`))
            .catch((err) => this.logger.warn(`Failed to invalidate cache for ${tenantId}`, err));
        }
      });
    }
  }
}
