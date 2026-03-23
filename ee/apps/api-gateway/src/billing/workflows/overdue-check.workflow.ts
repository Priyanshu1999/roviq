/**
 * OverdueInvoiceCheck — daily cron
 *
 * Marks sent invoices past their due date as overdue.
 */
import { proxyActivities } from '@temporalio/workflow';
import type { BillingActivities } from './billing.activities';

const { markOverdueInvoices } = proxyActivities<BillingActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2 minutes', backoffCoefficient: 2 },
});

export async function overdueInvoiceCheckWorkflow() {
  return markOverdueInvoices();
}
