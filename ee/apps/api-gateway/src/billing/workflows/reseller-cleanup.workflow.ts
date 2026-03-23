/**
 * ResellerDeletionBillingCleanup — triggered by reseller.deleted NATS event
 *
 * Transfers subscriptions to Roviq Direct, deactivates plans + configs.
 * Historical invoices retain original resellerId (audit trail).
 */
import { proxyActivities } from '@temporalio/workflow';
import type { BillingActivities } from './billing.activities';

const { cleanupResellerDeletion } = proxyActivities<BillingActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2 minutes', backoffCoefficient: 2 },
});

export async function resellerDeletionCleanupWorkflow(resellerId: string) {
  return cleanupResellerDeletion(resellerId);
}
