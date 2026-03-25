import {
  institutes,
  resellers,
  roviqAdmin,
  roviqApp,
  roviqReseller,
  trackingColumns,
} from '@roviq/database';
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { subscriptionStatus } from './enums';
import { plans } from './plans';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutes.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    resellerId: uuid('reseller_id')
      .notNull()
      .references(() => resellers.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: subscriptionStatus().default('ACTIVE').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    pauseReason: text('pause_reason'),
    gatewaySubscriptionId: varchar('gateway_subscription_id', { length: 255 }),
    gatewayProvider: varchar('gateway_provider', { length: 50 }),
    metadata: jsonb(),
    ...trackingColumns,
  },
  (table) => [
    index('subscriptions_tenant_id_idx').on(table.tenantId),
    index('subscriptions_plan_id_idx').on(table.planId),
    index('subscriptions_reseller_id_idx').on(table.resellerId),
    index('subscriptions_status_idx').on(table.status),
    // App: read own institute's subscriptions
    pgPolicy('sub_app_read', {
      for: 'select',
      to: roviqApp,
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    // Reseller: full CRUD on their subscriptions
    pgPolicy('sub_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Admin: break-glass full access
    pgPolicy('sub_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
