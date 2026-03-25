import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgPolicy, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { roviqAdmin } from '../common/rls-policies';
import { roles } from '../tenant/roles';
import { users } from './users';

export const platformMemberships = pgTable(
  'platform_memberships',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    abilities: jsonb().default([]),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_platform_membership_user').on(table.userId),
    // Only admin can access platform memberships — default deny for roviq_app and roviq_reseller
    pgPolicy('platform_membership_admin', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
