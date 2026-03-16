import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { invoiceStatus } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';
import { organizations } from '../tenant/organizations';
import { subscriptions } from './subscriptions';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid().defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    amount: integer().notNull(),
    currency: text().default('INR').notNull(),
    status: invoiceStatus().default('PENDING').notNull(),
    providerInvoiceId: text('provider_invoice_id'),
    providerPaymentId: text('provider_payment_id'),
    billingPeriodStart: timestamp('billing_period_start', {
      withTimezone: true,
    }).notNull(),
    billingPeriodEnd: timestamp('billing_period_end', {
      withTimezone: true,
    }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    ...entityColumns,
  },
  (table) => [
    index('invoices_organization_id_idx').using('btree', table.organizationId.asc().nullsLast()),
    index('invoices_subscription_id_idx').using('btree', table.subscriptionId.asc().nullsLast()),
    ...entityPolicies('invoices'),
  ],
);
