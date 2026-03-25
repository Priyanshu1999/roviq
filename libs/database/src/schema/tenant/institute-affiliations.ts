import { sql } from 'drizzle-orm';
import { date, foreignKey, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { affiliationStatus, boardType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

export const instituteAffiliations = pgTable(
  'institute_affiliations',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    board: boardType().notNull(),
    affiliationStatus: affiliationStatus('affiliation_status').default('PROVISIONAL').notNull(),
    affiliationNumber: text('affiliation_number'),
    grantedLevel: text('granted_level'),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to').notNull(),
    nocNumber: text('noc_number'),
    nocDate: date('noc_date'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('institute_affiliations_tenant_board_key')
      .on(table.tenantId, table.board)
      .where(sql`${table.deletedAt} IS NULL`),
    index('institute_affiliations_tenant_id_idx').on(table.tenantId),
    ...tenantPolicies('institute_affiliations'),
  ],
);
