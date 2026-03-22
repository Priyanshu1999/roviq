import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Immutable append-only audit trail — no update/delete columns */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().defaultRandom().notNull(),
    tenantId: uuid('tenant_id'), // nullable for platform-scoped audit events
    userId: uuid('user_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    impersonatorId: uuid('impersonator_id'),
    action: varchar({ length: 100 }).notNull(),
    actionType: varchar('action_type', { length: 20 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: uuid('entity_id'),
    changes: jsonb(),
    metadata: jsonb(),
    correlationId: uuid('correlation_id').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    source: varchar({ length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.id, table.createdAt],
      name: 'audit_logs_pkey',
    }),
    index('audit_logs_tenant_id_action_type_created_at_idx').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.actionType.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('audit_logs_tenant_id_entity_type_entity_id_created_at_idx').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.entityType.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('audit_logs_tenant_id_user_id_created_at_idx').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('audit_logs_correlation_id_idx').using('btree', table.correlationId.asc().nullsLast()),
    index('audit_logs_tenant_id_impersonator_id_idx')
      .using('btree', table.tenantId.asc().nullsLast(), table.impersonatorId.asc().nullsLast())
      .where(sql`(impersonator_id IS NOT NULL)`),
    pgPolicy('admin_platform_access_audit_logs', {
      for: 'select',
      using: sql`(current_setting('app.is_platform_admin'::text, true) = 'true'::text)`,
    }),
    pgPolicy('audit_insert', {
      for: 'insert',
      withCheck: sql`true`,
    }),
    pgPolicy('tenant_isolation_audit_logs', {
      for: 'select',
      using: sql`(tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);
