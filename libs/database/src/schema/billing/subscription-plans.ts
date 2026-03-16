import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { entityColumns, i18nText } from '../common/columns';
import { billingInterval, planStatus } from '../common/enums';

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid().defaultRandom().primaryKey(),
  name: i18nText('name').notNull(),
  description: i18nText('description'),
  amount: integer().notNull(),
  currency: text().default('INR').notNull(),
  billingInterval: billingInterval('billing_interval').notNull(),
  featureLimits: jsonb('feature_limits').notNull(),
  status: planStatus().default('ACTIVE').notNull(),
  ...entityColumns,
});
