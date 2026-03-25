import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgPolicy, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { timestamps } from '../common/columns';
import { roviqAdmin, roviqReseller } from '../common/rls-policies';
import { roles } from '../tenant/roles';
import { resellers } from './resellers';

export const resellerMemberships = pgTable(
  'reseller_memberships',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    resellerId: uuid('reseller_id')
      .notNull()
      .references(() => resellers.id),
    abilities: jsonb().default([]),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_reseller_membership').on(table.userId, table.resellerId),
    // Reseller can manage their own memberships
    pgPolicy('reseller_membership_own', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Admin has full access
    pgPolicy('reseller_membership_admin', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
