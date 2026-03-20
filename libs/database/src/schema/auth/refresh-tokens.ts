import { index, inet, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { memberships } from '../tenant/memberships';
import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id'), // nullable for platform admin tokens
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id').references(() => memberships.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    membershipScope: varchar('membership_scope', { length: 20 }).default('institute').notNull(),
    tokenHash: text('token_hash').notNull(),
    deviceInfo: text('device_info'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('refresh_tokens_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    index('refresh_tokens_token_hash_idx').using('btree', table.tokenHash.asc().nullsLast()),
    ...tenantPoliciesSimple('refresh_tokens'),
  ],
);
