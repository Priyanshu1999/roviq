import { sql } from 'drizzle-orm';
import { date, foreignKey, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { leaveStatus, leaveType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';
import { memberships } from './memberships';

/**
 * Lightweight leave application for staff and students.
 *
 * The attendance module consults this table at session-open time: when a
 * student has an APPROVED leave covering that date, their roster entry is
 * seeded with status=LEAVE instead of PRESENT.
 */
export const leaves = pgTable(
  'leaves',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    /** Membership the leave is for — student or staff. */
    userId: uuid('user_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Inclusive start date (YYYY-MM-DD). */
    startDate: date('start_date').notNull(),
    /** Inclusive end date (YYYY-MM-DD). Single-day leaves set startDate = endDate. */
    endDate: date('end_date').notNull(),
    type: leaveType('type').notNull(),
    reason: text('reason').notNull(),
    status: leaveStatus('status').default('PENDING').notNull(),
    /**
     * Array of uploaded supporting-document URLs (e.g. medical certificates).
     * Stored as JSONB for easy extension; empty array when none provided.
     */
    fileUrls: jsonb('file_urls').$type<string[]>().default([]).notNull(),
    /** Membership who approved / rejected. Null until a decision is taken. */
    decidedBy: uuid('decided_by').references(() => memberships.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('leaves_tenant_id_idx').on(table.tenantId),
    index('leaves_user_id_idx').on(table.userId),
    index('leaves_status_idx').on(table.status),
    // Typical lookup: "does this user have an approved leave covering date X?"
    index('leaves_user_range_idx').on(table.userId, table.startDate, table.endDate),
    ...tenantPolicies('leaves'),
  ],
);
