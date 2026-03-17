import { boolean, foreignKey, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { subjectType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

export const subjects = pgTable(
  'subjects',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    shortName: text('short_name'),
    boardCode: text('board_code'),
    type: subjectType().default('ACADEMIC').notNull(),
    isMandatory: boolean('is_mandatory').default(false).notNull(),
    hasPractical: boolean('has_practical').default(false).notNull(),
    theoryMarks: integer('theory_marks'),
    practicalMarks: integer('practical_marks'),
    internalMarks: integer('internal_marks'),
    isElective: boolean('is_elective').default(false).notNull(),
    electiveGroup: text('elective_group'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('subjects_tenant_id_idx').on(table.tenantId),
    index('subjects_type_idx').on(table.type),
    ...tenantPolicies('subjects'),
  ],
);
