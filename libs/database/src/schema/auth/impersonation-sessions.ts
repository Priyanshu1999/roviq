import { sql } from 'drizzle-orm';
import {
  check,
  index,
  inet,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { users } from './users';

export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    impersonatorId: uuid('impersonator_id')
      .notNull()
      .references(() => users.id),
    impersonatorScope: varchar('impersonator_scope', { length: 20 }).notNull(),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    targetTenantId: uuid('target_tenant_id').references(() => institutes.id),
    reason: text().notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedReason: varchar('ended_reason', { length: 50 }),
    otpVerified: timestamp('otp_verified', { withTimezone: true }),
    otpVerifiedBy: uuid('otp_verified_by').references(() => users.id),
  },
  (table) => [
    // Reason must be at least 10 characters
    check('chk_reason_length', sql`length(${table.reason}) >= 10`),
    // Session max 1 hour
    check('chk_max_duration', sql`${table.expiresAt} <= ${table.startedAt} + interval '1 hour'`),
    index('impersonation_sessions_impersonator_idx').on(table.impersonatorId),
    index('impersonation_sessions_target_user_idx').on(table.targetUserId),
    index('impersonation_sessions_target_tenant_idx').on(table.targetTenantId),
    // roviq_app: SELECT + INSERT (for audit trail)
    pgPolicy('impersonation_sessions_app_select', {
      for: 'select',
      to: roviqApp,
      using: sql`true`,
    }),
    pgPolicy('impersonation_sessions_app_insert', {
      for: 'insert',
      to: roviqApp,
      withCheck: sql`true`,
    }),
    // roviq_reseller: SELECT + INSERT + UPDATE (can start/end sessions)
    pgPolicy('impersonation_sessions_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // roviq_admin: full access
    pgPolicy('impersonation_sessions_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
