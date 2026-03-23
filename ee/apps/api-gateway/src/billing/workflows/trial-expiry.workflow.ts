/**
 * TrialExpiryWorkflow — daily cron
 *
 * 1. Send reminders 3 days before trial ends
 * 2. Expire trials past their end date
 */
import { proxyActivities } from '@temporalio/workflow';
import type { BillingActivities } from './billing.activities';

const { processTrialExpiry } = proxyActivities<BillingActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2 minutes', backoffCoefficient: 2 },
});

export async function trialExpiryWorkflow() {
  return processTrialExpiry();
}
