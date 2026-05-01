import type { SubscriptionStatus } from '../enums/billing';
import { defineStateMachine } from '../state-machine';

// Transitions derived from observed behaviour in
// `ee/apps/api-gateway/src/billing/billing.service.ts` (manual cancel/pause/
// resume) and `billing-event.consumer.ts` (gateway webhooks). PAUSED→PAST_DUE
// and TRIALING→ACTIVE/EXPIRED are the gateway-driven paths; the rest are
// reseller-initiated.
export const SUBSCRIPTION_STATE_MACHINE = defineStateMachine<SubscriptionStatus>('Subscription', {
  TRIALING: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['PAUSED', 'PAST_DUE', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
});
