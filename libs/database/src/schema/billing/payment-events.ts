import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { paymentProvider } from '../common/enums';
import { immutableEntityPolicies } from '../common/rls-policies';
import { invoices } from './invoices';
import { subscriptions } from './subscriptions';

/** Immutable append-only webhook events — no update/delete columns */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id'),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    provider: paymentProvider().notNull(),
    eventType: text('event_type').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    payload: jsonb().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_events_provider_event_id_key').using(
      'btree',
      table.providerEventId.asc().nullsLast(),
    ),
    index('payment_events_subscription_id_idx').using(
      'btree',
      table.subscriptionId.asc().nullsLast(),
    ),
    index('payment_events_invoice_id_idx').using('btree', table.invoiceId.asc().nullsLast()),
    ...immutableEntityPolicies('payment_events'),
  ],
);
