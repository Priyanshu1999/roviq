import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { i18nText, tenantColumns } from '../common/columns';
import { educationLevel, nepStage } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { academicYears } from './academic-years';
import { institutes } from './institutes';

export const standards = pgTable(
  'standards',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    name: i18nText('name').notNull(),
    numericOrder: integer('numeric_order').notNull(),
    level: educationLevel(),
    nepStage: nepStage('nep_stage'),
    department: text(),
    isBoardExamClass: boolean('is_board_exam_class').default(false).notNull(),
    streamApplicable: boolean('stream_applicable').default(false).notNull(),
    maxSectionsAllowed: integer('max_sections_allowed'),
    maxStudentsPerSection: integer('max_students_per_section').default(40),
    udiseClassCode: integer('udise_class_code'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('standards_tenant_year_name_key')
      .on(table.tenantId, table.academicYearId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('standards_tenant_year_order_key')
      .on(table.tenantId, table.academicYearId, table.numericOrder)
      .where(sql`${table.deletedAt} IS NULL`),
    index('standards_tenant_id_idx').on(table.tenantId),
    index('standards_academic_year_id_idx').on(table.academicYearId),
    ...tenantPolicies('standards'),
  ],
);
