import { sql } from 'drizzle-orm';
import { foreignKey, index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';
import { standards } from './standards';
import { subjects } from './subjects';

export const standardSubjects = pgTable(
  'standard_subjects',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => standards.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('standard_subjects_subject_standard_key').on(table.subjectId, table.standardId),
    index('standard_subjects_tenant_id_idx').on(table.tenantId),
    index('standard_subjects_standard_id_idx').on(table.standardId),
    ...tenantPolicies('standard_subjects'),
  ],
);
