import { DynamicGroupStatus, GroupMembershipType } from '@roviq/common-types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { domainGroupType, dynamicGroupStatus, groupMembershipType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';

/**
 * Dynamic groups — the core entity for the Groups Engine.
 *
 * Groups can be system-created (per-section, per-subject) or user-created (clubs, committees).
 * Membership can be static (manual), dynamic (rule-based), or hybrid (rule + manual overrides).
 * Supports parent-child hierarchy via self-referencing `parent_group_id`.
 *
 * Three-tier RLS enforced.
 */
export const groups = pgTable(
  'groups',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),

    /**
     * Group purpose/category:
     * - `class`: all students in a standard (e.g., "Class 10")
     * - `section`: all students in a section (e.g., "Class 10-A")
     * - `house`: inter-house competition grouping (e.g., "Red House")
     * - `club`: extracurricular club (e.g., "Science Club", "Drama Club")
     * - `sports_team`: sports team roster (e.g., "Cricket U-14")
     * - `bus_route`: students sharing a transport route
     * - `subject`: students enrolled in a specific subject
     * - `stream`: students in an academic stream (Science PCM, Commerce, etc.)
     * - `fee`: students sharing a fee structure (e.g., "RTE Students", "Sibling Discount")
     * - `exam`: students appearing for a specific examination
     * - `notification`: recipients for a notification channel
     * - `activity`: participants in a time-bound activity (field trip, event)
     * - `department`: staff in an academic/administrative department
     * - `committee`: staff committee (e.g., "Discipline Committee")
     * - `composite`: meta-group combining multiple child groups
     * - `custom`: institute-defined group type not covered above
     */
    groupType: domainGroupType('group_type').notNull(),

    /**
     * How group membership is determined:
     * - `static`: members added/removed manually only
     * - `dynamic`: members resolved automatically from group_rules (JsonLogic)
     * - `hybrid`: rule-based with manual inclusions/exclusions
     */
    membershipType: groupMembershipType('membership_type')
      .notNull()
      .default(GroupMembershipType.DYNAMIC),

    /**
     * Which user types can be members of this group.
     * PostgreSQL TEXT[] — e.g., '{student}', '{staff}', '{student,staff,guardian}'.
     */
    memberTypes: text('member_types').array().notNull().default(sql`'{student}'`),
    /** Whether this group was auto-created by the system (e.g., per-section groups on section creation) */
    isSystem: boolean('is_system').notNull().default(false),

    /** Group lifecycle state — pgEnum enforces membership natively. */
    status: dynamicGroupStatus('status').notNull().default(DynamicGroupStatus.ACTIVE),

    /** Last time dynamic membership was resolved (NULL if never resolved) */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Denormalized member count from last resolution — for dashboard display */
    memberCount: integer('member_count').notNull().default(0),

    /** Self-referencing FK for simple parent-child hierarchy (nullable) */
    parentGroupId: uuid('parent_group_id'),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    /** Self-referencing FK for group hierarchy */
    foreignKey({
      columns: [table.parentGroupId],
      foreignColumns: [table.id],
    }),

    /** Group name unique per tenant among non-deleted groups */
    uniqueIndex('idx_group_name_active')
      .on(table.tenantId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('groups'),
  ],
).enableRLS();
