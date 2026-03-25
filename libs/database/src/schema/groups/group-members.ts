import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { memberships } from '../tenant/memberships';
import { groups } from './groups';

/**
 * Group membership — static (manually added), rule-resolved, or inherited from parent group.
 *
 * Hybrid groups support manual exclusions via `is_excluded` flag (member matches rules
 * but is explicitly excluded by admin). UNIQUE(group_id, membership_id) prevents duplicates.
 *
 * No soft delete (tenantPoliciesSimple). Three-tier RLS enforced.
 */
export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    /**
     * How this member was added to the group:
     * - `manual`: explicitly added by an admin or teacher
     * - `rule`: automatically resolved from group_rules (JsonLogic evaluation)
     * - `inherited`: inherited from a parent group in the hierarchy
     */
    source: varchar('source', { length: 10 }).notNull(),
    /**
     * For hybrid groups: manually excluded even though rules match.
     * Admin override to remove a specific member from dynamic resolution results.
     */
    isExcluded: boolean('is_excluded').notNull().default(false),
    /** When this membership was last resolved/confirmed by the group engine */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check('chk_member_source', sql`${table.source} IN ('manual', 'rule', 'inherited')`),

    /** Each membership can appear at most once per group */
    uniqueIndex('uq_group_member').on(table.groupId, table.membershipId),
    /** Active (non-excluded) members per group — used for member list queries */
    index('idx_group_members_group').on(table.groupId).where(sql`${table.isExcluded} = false`),
    /** All groups a membership belongs to — used for "my groups" queries */
    index('idx_group_members_membership').on(table.membershipId),

    ...tenantPoliciesSimple('group_members'),
  ],
).enableRLS();
