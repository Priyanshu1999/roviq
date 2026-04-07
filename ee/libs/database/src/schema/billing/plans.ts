import {
  entityColumns,
  i18nText,
  resellers,
  roviqAdmin,
  roviqApp,
  roviqReseller,
} from '@roviq/database';
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
    // Reseller: read own live plans (hides soft-deleted)
    pgPolicy('plan_reseller_select', {
      for: 'select',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid AND deleted_at IS NULL`,
    }),
    // Reseller: trash view for soft-deleted plans (restore flow)
    pgPolicy('plan_reseller_trash', {
      for: 'select',
      to: roviqReseller,
      using: sql`
        reseller_id = current_setting('app.current_reseller_id', true)::uuid
        AND deleted_at IS NOT NULL
        AND current_setting('app.include_deleted', true) = 'true'
      `,
    }),
    // Reseller: insert own plans only
    pgPolicy('plan_reseller_insert', {
      for: 'insert',
      to: roviqReseller,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Reseller: update own plans — no deleted_at filter so soft-delete + restore both work.
    // WITH CHECK prevents changing reseller_id ownership.
    pgPolicy('plan_reseller_update', {
      for: 'update',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Reseller: hard delete blocked — soft-delete via UPDATE instead
    pgPolicy('plan_reseller_delete', {
      for: 'delete',
      to: roviqReseller,
      using: sql`false`,
    }),
    // App: can only see plans that their institute is subscribed to
    pgPolicy('plan_app_read', {
      for: 'select',
      to: roviqApp,
      using: sql`
        id IN (
          SELECT plan_id FROM subscriptions
          WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
        AND deleted_at IS NULL
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
