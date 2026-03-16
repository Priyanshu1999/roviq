import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { subscriptionStatus } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { subscriptionPlans } from './subscription-plans';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid().defaultRandom().primaryKey(),
    instituteId: uuid('institute_id')
      .notNull()
      .references(() => institutes.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    status: subscriptionStatus().default('PENDING_PAYMENT').notNull(),
    providerSubscriptionId: text('provider_subscription_id'),
    providerCustomerId: text('provider_customer_id'),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    ...entityColumns,
  },
  (table) => [
    index('subscriptions_institute_id_idx').using('btree', table.instituteId.asc().nullsLast()),
    index('subscriptions_plan_id_idx').using('btree', table.planId.asc().nullsLast()),
    ...entityPolicies('subscriptions'),
  ],
);
