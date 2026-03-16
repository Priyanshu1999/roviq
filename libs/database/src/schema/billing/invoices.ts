import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { invoiceStatus } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
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
    instituteId: uuid('institute_id')
      .notNull()
      .references(() => institutes.id, {
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
    index('invoices_institute_id_idx').using('btree', table.instituteId.asc().nullsLast()),
    index('invoices_subscription_id_idx').using('btree', table.subscriptionId.asc().nullsLast()),
    ...entityPolicies('invoices'),
  ],
);
