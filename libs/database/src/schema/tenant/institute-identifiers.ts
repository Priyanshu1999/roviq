import { sql } from 'drizzle-orm';
import { date, foreignKey, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { identifierType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

export const instituteIdentifiers = pgTable(
  'institute_identifiers',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    type: identifierType().notNull(),
    value: text().notNull(),
    issuingAuthority: text('issuing_authority'),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('institute_identifiers_tenant_type_key')
      .on(table.tenantId, table.type)
      .where(sql`${table.deletedAt} IS NULL`),
    index('institute_identifiers_tenant_id_idx').on(table.tenantId),
    ...tenantPolicies('institute_identifiers'),
  ],
);
