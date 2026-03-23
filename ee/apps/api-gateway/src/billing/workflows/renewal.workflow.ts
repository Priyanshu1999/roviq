/**
 * SubscriptionRenewalWorkflow — daily cron (00:00 UTC)
 *
 * 1. Generate invoices for subscriptions within 7 days of period end (idempotent)
 * 2. Cancel past_due subscriptions that exceeded 7-day grace period
 */
import { proxyActivities } from '@temporalio/workflow';
import type { BillingActivities } from './billing.activities';

const { processRenewals, cancelGracePeriodExpired } = proxyActivities<BillingActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2 minutes', backoffCoefficient: 2 },
});

export async function subscriptionRenewalWorkflow() {
  const renewalResult = await processRenewals();
  const graceResult = await cancelGracePeriodExpired();
  return { ...renewalResult, ...graceResult };
}
