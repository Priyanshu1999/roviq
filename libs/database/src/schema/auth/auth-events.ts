import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import { users } from './users';

export const authEvents = pgTable(
  'auth_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    scope: varchar({ length: 20 }),
    tenantId: uuid('tenant_id'),
    resellerId: uuid('reseller_id'),
    authMethod: varchar('auth_method', { length: 30 }),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    deviceInfo: text('device_info'),
    failureReason: text('failure_reason'),
    metadata: jsonb().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('auth_events_user_id_idx').on(table.userId),
    index('auth_events_event_type_idx').on(table.eventType),
    index('auth_events_tenant_id_idx').on(table.tenantId),
    index('auth_events_created_at_idx').on(table.createdAt),
    // roviq_app and roviq_reseller: INSERT only (emit events)
    pgPolicy('auth_events_app_insert', {
      for: 'insert',
      to: roviqApp,
      withCheck: sql`true`,
    }),
    pgPolicy('auth_events_reseller_insert', {
      for: 'insert',
      to: roviqReseller,
      withCheck: sql`true`,
    }),
    // roviq_admin: full access (read all events)
    pgPolicy('auth_events_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
