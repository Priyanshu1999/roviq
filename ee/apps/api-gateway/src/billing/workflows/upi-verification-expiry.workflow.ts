/**
 * UpiVerificationExpiryCheck — daily cron
 *
 * Expires PENDING_VERIFICATION UPI P2P payments past 24h deadline.
 * Full reversal: decrement paidAmount, revert invoice status,
 * revert subscription to PAST_DUE if applicable.
 */
import { proxyActivities } from '@temporalio/workflow';
import type { BillingActivities } from './billing.activities';

const { expireUpiVerifications } = proxyActivities<BillingActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2 minutes', backoffCoefficient: 2 },
});

export async function upiVerificationExpiryWorkflow() {
  return expireUpiVerifications();
}
