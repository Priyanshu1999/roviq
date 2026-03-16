import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { memberships } from '../tenant/memberships';
import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id').references(() => memberships.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    tokenHash: text('token_hash').notNull(),
    deviceInfo: text('device_info'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('refresh_tokens_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    index('refresh_tokens_token_hash_idx').using('btree', table.tokenHash.asc().nullsLast()),
    ...tenantPoliciesSimple('refresh_tokens'),
  ],
);
