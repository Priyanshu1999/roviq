import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { academicYears } from '../tenant/academic-years';
import { institutes } from '../tenant/institutes';
import { sections } from '../tenant/sections';
import { standards } from '../tenant/standards';
import { studentProfiles } from './student-profiles';

/**
 * One row per student per academic year — tracks section placement,
 * roll number, house assignment, and promotion status.
 *
 * Three-tier RLS enforced (same as student_profiles).
 */
export const studentAcademics = pgTable(
  'student_academics',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standards.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    /** Roll number within the section (institute-assigned) */
    rollNumber: varchar('roll_number', { length: 10 }),
    /** FK to houses table (future module) — for house system / inter-house competitions */
    houseId: uuid('house_id'),
    /** FK to transport routes table (future module) — for bus route assignment */
    routeId: uuid('route_id'),
    /** Student roles within the class: ['class_monitor', 'prefect', 'house_captain', ...] */
    classRoles: jsonb('class_roles').$type<string[]>().default([]),
    /**
     * End-of-year promotion outcome:
     * - `pending`: academic year still active, no decision yet
     * - `promoted`: passed and will move to next standard
     * - `detained`: failed and will repeat current standard
     * - `graduated`: completed final year (Class 10/12 or coaching program)
     * - `transferred`: left this institute before promotion decision
     */
    promotionStatus: varchar('promotion_status', { length: 20 }),
    /** Standard the student was promoted to — NULL if pending, detained, or transferred */
    promotedToStandardId: uuid('promoted_to_standard_id').references(() => standards.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_promotion_status',
      sql`${table.promotionStatus} IS NULL OR ${table.promotionStatus} IN (
        'pending', 'promoted', 'detained', 'graduated', 'transferred'
      )`,
    ),

    /** One enrollment record per student per academic year */
    uniqueIndex('uq_student_academic_year').on(table.studentProfileId, table.academicYearId),
    /** Section roster lookup: all students in a section for an academic year */
    index('idx_student_academics_section')
      .on(table.tenantId, table.academicYearId, table.sectionId)
      .where(sql`${table.deletedAt} IS NULL`),
    /** Standard roster lookup: all students in a standard for an academic year */
    index('idx_student_academics_standard')
      .on(table.tenantId, table.academicYearId, table.standardId)
      .where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('student_academics'),
  ],
).enableRLS();
