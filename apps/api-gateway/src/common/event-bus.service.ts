// Shared event bus that publishes events to both:
//   1. NATS JetStream — for inter-service consumers
//   2. GraphQL PubSub — for real-time client subscriptions
//
// All domain services emit through this so the dual fan-out and the
// camelCase subscription-key conversion live in exactly one place. The
// `pattern` parameter is typed as `EventPattern`, the union of every
// subject in `EVENT_PATTERNS`. A typo is a compile error rather than a
// runtime "no stream matches subject" — historical bug class this
// pattern eliminates.

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { EventPattern } from '@roviq/nats-jetstream';
import { pubSub } from './pubsub';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(@Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy) {}

  emit(pattern: EventPattern, data: Record<string, unknown>): void {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });

    const subscriptionField = toSubscriptionKey(pattern);
    pubSub.publish(pattern, { [subscriptionField]: data });
  }
}

// Convert a NATS dot-separated subject to a camelCase GraphQL
// subscription field name. Exported for the unit test that asserts every
// `pubSub.asyncIterableIterator(subject)` call site uses a key the bus
// will actually publish under.
//
// Examples:
//   'INSTITUTE.created'          → 'instituteCreated'
//   'INSTITUTE.branding_updated' → 'instituteBrandingUpdated'
//   'ACADEMIC_YEAR.activated'    → 'academicYearActivated'
//   'NOTIFICATION.user.created'  → 'notificationUserCreated'
export function toSubscriptionKey(pattern: string): string {
  const [rawHead = '', ...rest] = pattern.split('.');
  const head = rawHead.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const tail = rest
    .map((seg) => seg.replace(/(^|_)([a-z])/g, (_, _sep: string, c: string) => c.toUpperCase()))
    .join('');
  return `${head}${tail}`;
}
