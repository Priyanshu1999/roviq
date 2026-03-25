import { sql } from 'drizzle-orm';
import { foreignKey, index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';
import { sections } from './sections';
import { subjects } from './subjects';

export const sectionSubjects = pgTable(
  'section_subjects',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('section_subjects_subject_section_key').on(table.subjectId, table.sectionId),
    index('section_subjects_tenant_id_idx').on(table.tenantId),
    index('section_subjects_section_id_idx').on(table.sectionId),
    ...tenantPolicies('section_subjects'),
  ],
);
