import type { InvoiceStatus } from '../enums/billing';
import { defineStateMachine } from '../state-machine';

// Transitions derived from observed behaviour in
// `ee/apps/api-gateway/src/billing/reseller/invoice.service.ts` and
// `workflows/billing.activities.ts`. PARTIALLY_PAID is a transient
// staging state that can roll back from a refund or progress to PAID.
export const INVOICE_STATE_MACHINE = defineStateMachine<InvoiceStatus>('Invoice', {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'REFUNDED', 'CANCELLED'],
  OVERDUE: ['PAID', 'PARTIALLY_PAID', 'CANCELLED'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
  CANCELLED: [],
});
