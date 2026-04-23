import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from '../../common/columns';
import { attendanceMode, attendanceStatus } from '../../common/enums';
import { tenantPolicies } from '../../common/rls-policies';
import { institutes } from '../institutes';
import { memberships } from '../memberships';
import { attendanceSessions } from './attendance-sessions';

/**
 * One row per student per attendance session — the student's mark for that period.
 *
 * `studentId` is the student's membership id (not users.id).
 */
export const attendanceEntries = pgTable(
  'attendance_entries',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Student membership — the attendee. */
    studentId: uuid('student_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    status: attendanceStatus('status').notNull(),
    mode: attendanceMode('mode').default('MANUAL').notNull(),
    /** Optional free-text note from the teacher. */
    remarks: text('remarks'),
    /** When the mark was set (or last updated). Distinct from createdAt/updatedAt. */
    markedAt: timestamp('marked_at', { withTimezone: true }).defaultNow().notNull(),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('attendance_entries_session_student_key')
      .on(table.sessionId, table.studentId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('attendance_entries_tenant_id_idx').on(table.tenantId),
    index('attendance_entries_session_id_idx').on(table.sessionId),
    index('attendance_entries_student_id_idx').on(table.studentId),
    index('attendance_entries_status_idx').on(table.status),
    ...tenantPolicies('attendance_entries'),
  ],
);
