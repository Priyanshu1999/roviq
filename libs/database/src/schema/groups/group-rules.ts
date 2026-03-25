import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { groups } from './groups';

/**
 * Dynamic membership rules stored as JsonLogic JSONB.
 *
 * Each rule defines criteria for automatic group membership resolution.
 * rule_dimensions tracks which data dimensions the rule depends on,
 * enabling targeted invalidation (only recalculate when a relevant dimension changes).
 *
 * No soft delete (tenantPoliciesSimple). Three-tier RLS enforced.
 */
export const groupRules = pgTable(
  'group_rules',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    /** JsonLogic rule definition — evaluated against student/staff profile data */
    rule: jsonb('rule').notNull(),
    /**
     * Data dimensions this rule depends on — used for targeted invalidation.
     * Only recalculate group membership when a change affects a listed dimension.
     * Example: ['standard', 'section', 'gender', 'stream', 'academic_status']
     */
    ruleDimensions: text('rule_dimensions').array().notNull(),
    /** Human-readable description — e.g., "All female students in Class 10 Science" */
    description: text('description'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    index('idx_group_rules_group').on(table.groupId),
    index('idx_group_rules_tenant').on(table.tenantId),

    ...tenantPoliciesSimple('group_rules'),
  ],
).enableRLS();
