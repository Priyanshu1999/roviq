import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { i18nText, tenantColumns } from '../common/columns';
import { batchStatus, genderRestriction } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { academicYears } from './academic-years';
import { institutes } from './institutes';
import { memberships } from './memberships';
import { standards } from './standards';

/** Stream assignment for senior secondary sections (e.g., Science PCM, Commerce) */
export type StreamConfig = {
  /** Human-readable stream name (e.g., "Science PCM", "Commerce") */
  name: string;
  /** Machine-readable code (e.g., "sci_pcm", "commerce") */
  code: string;
};

export const sections = pgTable(
  'sections',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standards.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: i18nText('name').notNull(),
    displayLabel: text('display_label'),
    /** Stream for senior secondary (11-12). JSONB because NEP 2020 allows cross-stream combos */
    stream: jsonb().$type<StreamConfig>(),
    /** Language of instruction: english, hindi, bilingual, urdu. Per-section, not per-institute */
    mediumOfInstruction: text('medium_of_instruction'),
    shift: text(),
    classTeacherId: uuid('class_teacher_id').references(() => memberships.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    room: text(),
    capacity: integer().default(40),
    currentStrength: integer('current_strength').default(0).notNull(),
    genderRestriction: genderRestriction('gender_restriction').default('CO_ED').notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    // Coaching batch fields
    startTime: time('start_time'),
    endTime: time('end_time'),
    batchStatus: batchStatus('batch_status'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('sections_standard_name_key')
      .on(table.standardId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('sections_tenant_id_idx').on(table.tenantId),
    index('sections_standard_id_idx').on(table.standardId),
    index('sections_academic_year_id_idx').on(table.academicYearId),
    ...tenantPolicies('sections'),
  ],
);
