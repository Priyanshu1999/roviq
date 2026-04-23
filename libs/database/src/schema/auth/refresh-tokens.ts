import { sql } from 'drizzle-orm';
import { index, inet, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    tenantId: uuid('tenant_id'), // nullable for platform admin tokens
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    // References platform_memberships, reseller_memberships, or memberships depending on scope
    // No FK constraint — scope-polymorphic reference
    membershipId: uuid('membership_id').notNull(),
    membershipScope: varchar('membership_scope', { length: 20 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    deviceInfo: text('device_info'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /**
     * Why the row was revoked. Populated alongside `revokedAt`:
     *  - `rotation`        — replaced by a successor during the refresh flow
     *                        (successor is issued, this row is marked done).
     *                        Reusing a `rotation`-revoked token is the
     *                        canonical "refresh token reuse" signal: we
     *                        cascade-revoke every other token for the user.
     *  - `user_initiated`  — revoked via `revokeAllOtherSessions` or an
     *                        explicit session-kill action. Presenting a
     *                        token revoked this way is NOT stolen-token
     *                        evidence, so the reuse-cascade must be
     *                        skipped — otherwise the user's keep-alive
     *                        session gets killed on the next API call.
     *  - `password_change` — invalidated because the user rotated their
     *                        password; same semantics as user_initiated.
     *  - `admin_revoked`   — platform/reseller admin revoked the session.
     *
     * Nullable because the column was added after the feature shipped;
     * older rows have NULL and fall back to the stricter "treat as
     * rotation" cascade path.
     */
    revokedReason: varchar('revoked_reason', { length: 32 }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('refresh_tokens_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    index('refresh_tokens_token_hash_idx').using('btree', table.tokenHash.asc().nullsLast()),
    ...tenantPoliciesSimple('refresh_tokens'),
  ],
);
