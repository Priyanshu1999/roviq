import { sql } from 'drizzle-orm';
import {
  check,
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
import { impersonationSessions } from '../auth/impersonation-sessions';
import { users } from '../auth/users';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import { resellers } from '../reseller/resellers';
import { institutes } from '../tenant/institutes';

/** Immutable append-only audit trail — no update/delete columns */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().default(sql`uuidv7()`).notNull(),
    /** 'platform' | 'reseller' | 'institute' — determines which RLS policy grants visibility */
    scope: varchar({ length: 20 }).notNull(),
    /** NULL for platform/reseller-scoped audit events; NOT NULL for institute-scoped */
    tenantId: uuid('tenant_id').references(() => institutes.id),
    /** Set only for reseller-scoped actions; NULL for platform/institute */
    resellerId: uuid('reseller_id').references(() => resellers.id),
    /** The user whose data was affected by the action */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** Real person who performed the action. Same as userId unless impersonating */
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    /** Set only during impersonation — the admin/reseller who is acting on behalf of userId */
    impersonatorId: uuid('impersonator_id').references(() => users.id),
    /** FK to impersonation_sessions for full impersonation audit trail */
    impersonationSessionId: uuid('impersonation_session_id').references(
      () => impersonationSessions.id,
    ),
    /** Domain action name, e.g. 'createStudent', 'suspendInstitute' */
    action: varchar({ length: 100 }).notNull(),
    /** CREATE, UPDATE, DELETE, RESTORE, ASSIGN, REVOKE, SUSPEND, ACTIVATE */
    actionType: varchar('action_type', { length: 20 }).notNull(),
    /** Entity type affected, e.g. 'Student', 'Institute', 'SubscriptionPlan' */
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    /** ID of the affected entity; NULL for bulk operations */
    entityId: uuid('entity_id'),
    /** { field: { old, new } } for UPDATE; full snapshot for DELETE; NULL for bulk ops */
    changes: jsonb(),
    /** { affected_count, entity_ids[], input, error } — additional action context */
    metadata: jsonb(),
    /** Request correlation ID for tracing across services */
    correlationId: uuid('correlation_id').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    /** Source system: 'api-gateway', 'temporal-worker', 'nats-consumer', etc. */
    source: varchar({ length: 50 }).notNull(),
    /**
     * Set when actorId is the synthetic-user UUID — identifies the originating
     * workflow, event consumer, or seeder. NULL for normal JWT-driven requests.
     * Examples: 'workflow:tc-issuance', 'consumer:billing-event'.
     */
    syntheticOrigin: text('synthetic_origin'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite PK required for partitioning (partition key must be in PK)
    primaryKey({
      columns: [table.id, table.createdAt],
      name: 'audit_logs_pkey',
    }),

    // CHECK: scope determines which FK columns must be set
    check(
      'chk_audit_scope',
      sql`CASE "scope"
        WHEN 'institute' THEN "tenant_id" IS NOT NULL
        WHEN 'reseller'  THEN "reseller_id" IS NOT NULL AND "tenant_id" IS NULL
        WHEN 'platform'  THEN "tenant_id" IS NULL AND "reseller_id" IS NULL
      END`,
    ),

    // === RLS Policies (5-role model) ===

    // roviq_app: can INSERT any row, can SELECT only institute-scoped rows for their tenant
    pgPolicy('audit_app_read', {
      for: 'select',
      to: roviqApp,
      using: sql`scope = 'institute' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy('audit_app_insert', {
      for: 'insert',
      to: roviqApp,
      withCheck: sql`true`,
    }),

    // roviq_reseller: can INSERT any row, can SELECT their institutes + own reseller entries
    pgPolicy('audit_reseller_read', {
      for: 'select',
      to: roviqReseller,
      using: sql`(scope = 'institute' AND tenant_id IN (SELECT id FROM institutes WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid)) OR (scope = 'reseller' AND reseller_id = current_setting('app.current_reseller_id', true)::uuid)`,
    }),
    pgPolicy('audit_reseller_insert', {
      for: 'insert',
      to: roviqReseller,
      withCheck: sql`true`,
    }),

    // roviq_admin: full access (SELECT, INSERT, UPDATE, DELETE)
    pgPolicy('audit_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
