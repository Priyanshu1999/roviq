import { sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { userStatus } from '../common/enums';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    username: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    status: userStatus().default('ACTIVE').notNull(),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_key').using('btree', table.email.asc().nullsLast()),
    uniqueIndex('users_username_key').using('btree', table.username.asc().nullsLast()),
    // All roles can SELECT users
    pgPolicy('users_app_select', {
      for: 'select',
      to: roviqApp,
      using: sql`true`,
    }),
    pgPolicy('users_reseller_select', {
      for: 'select',
      to: roviqReseller,
      using: sql`true`,
    }),
    // Only admin can INSERT/UPDATE/DELETE
    pgPolicy('users_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
