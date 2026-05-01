import {
  entityColumns,
  i18nText,
  resellers,
  roviqAdmin,
  roviqApp,
  roviqReseller,
} from '@roviq/database';
// Note: plansLive view in ./live-views.ts handles soft-delete visibility.
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { billingInterval, planStatus } from './enums';
import { money } from './helpers';
import type { PlanEntitlements } from './types';

export const plans = pgTable(
  'plans',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    resellerId: uuid('reseller_id')
      .notNull()
      .references(() => resellers.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: i18nText('name').notNull(),
    description: i18nText('description'),
    code: varchar({ length: 50 }).notNull(),
    status: planStatus().default('ACTIVE').notNull(),
    interval: billingInterval().notNull(),
    amount: money('amount'),
    currency: varchar({ length: 3 }).default('INR').notNull(),
    trialDays: integer('trial_days').default(0).notNull(),
    entitlements: jsonb()
      .$type<PlanEntitlements>()
      .default({
        maxStudents: null,
        maxStaff: null,
        maxStorageMb: null,
        auditLogRetentionDays: 90,
        features: [],
      })
      .notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    ...entityColumns,
  },
  (table) => [
    index('plans_reseller_id_idx').on(table.resellerId),
    index('plans_status_idx').on(table.status),
    // Reseller: read own plans. Soft-delete visibility lives in `plansLive`,
    // not RLS — see drizzle-database skill.
    pgPolicy('plan_reseller_select', {
      for: 'select',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    pgPolicy('plan_reseller_insert', {
      for: 'insert',
      to: roviqReseller,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // No deleted_at filter so soft-delete + restore both work.
    pgPolicy('plan_reseller_update', {
      for: 'update',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Hard delete blocked — soft-delete via UPDATE instead
    pgPolicy('plan_reseller_delete', {
      for: 'delete',
      to: roviqReseller,
      using: sql`false`,
    }),
    // App: only plans the institute is subscribed to. Live filtering goes
    // through plansLive at the repository layer.
    pgPolicy('plan_app_read', {
      for: 'select',
      to: roviqApp,
      using: sql`
        id IN (
          SELECT plan_id FROM subscriptions
          WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
      `,
    }),
    // Admin: break-glass full access
    pgPolicy('plan_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
