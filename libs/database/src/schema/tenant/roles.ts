import { boolean, foreignKey, index, jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { i18nText, tenantColumns } from '../common/columns';
import { roleStatus } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey(),
    ...tenantColumns,
    name: i18nText('name').notNull(),
    abilities: jsonb().default([]).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    status: roleStatus().default('ACTIVE').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    uniqueIndex('roles_tenant_id_name_key').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.name.asc().nullsLast(),
    ),
    index('roles_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    ...tenantPolicies('roles'),
  ],
);
