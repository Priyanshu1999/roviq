import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { academicYearStatus } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import type { TermConfig } from './institute-configs';
import { institutes } from './institutes';

/** Derived type from the pgEnum — 'PLANNING' | 'ACTIVE' | 'COMPLETING' | 'ARCHIVED' */
export type AcademicYearStatus = (typeof academicYearStatus.enumValues)[number];

export const academicYears = pgTable(
  'academic_years',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    label: text().notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    isActive: boolean('is_active').default(false).notNull(),
    status: academicYearStatus().default('PLANNING').notNull(),
    termStructure: jsonb('term_structure').$type<TermConfig[]>().default([]),
    boardExamDates: jsonb('board_exam_dates').$type<Record<string, unknown>>().default({}),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    // Only one active academic year per institute
    uniqueIndex('academic_years_tenant_active_key')
      .on(table.tenantId)
      .where(sql`${table.isActive} = true AND ${table.deletedAt} IS NULL`),
    // No overlapping date ranges (requires btree_gist extension)
    // Handled at application level since Drizzle doesn't support EXCLUDE constraints
    check('academic_years_date_check', sql`${table.startDate} < ${table.endDate}`),
    index('academic_years_tenant_id_idx').on(table.tenantId),
    ...tenantPolicies('academic_years'),
  ],
);
