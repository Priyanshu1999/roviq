import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { resellerStatus, resellerTier } from '../common/enums';
import { roviqAdmin, roviqReseller } from '../common/rls-policies';

export const resellers = pgTable(
  'resellers',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 100 }).notNull(),
    tier: resellerTier().default('full_management').notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    status: resellerStatus().default('active').notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    branding: jsonb().default({}),
    customDomain: varchar('custom_domain', { length: 255 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('resellers_slug_key').on(table.slug),
    // RLS: reseller can read own record
    pgPolicy('reseller_own_read', {
      for: 'select',
      to: roviqReseller,
      using: sql`id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // RLS: admin has full access
    pgPolicy('reseller_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
