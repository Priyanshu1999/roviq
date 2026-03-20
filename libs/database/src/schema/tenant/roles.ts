import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { entityColumns, i18nText } from '../common/columns';
import { roleStatus } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { resellers } from '../reseller/resellers';
import { institutes } from './institutes';

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey(),
    // Nullable for platform/reseller scoped roles
    tenantId: uuid('tenant_id'),
    scope: varchar({ length: 20 }).default('institute').notNull(),
    resellerId: uuid('reseller_id').references(() => resellers.id),
    name: i18nText('name').notNull(),
    abilities: jsonb().default([]).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    status: roleStatus().default('ACTIVE').notNull(),
    ...entityColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    // Scope constraint: platform = no tenant/reseller, reseller = reseller only, institute = tenant only
    check(
      'chk_role_scope',
      sql`CASE ${table.scope}
        WHEN 'platform'  THEN ${table.tenantId} IS NULL AND ${table.resellerId} IS NULL
        WHEN 'reseller'  THEN ${table.tenantId} IS NULL AND ${table.resellerId} IS NOT NULL
        WHEN 'institute' THEN ${table.tenantId} IS NOT NULL AND ${table.resellerId} IS NULL
      END`,
    ),
    uniqueIndex('roles_tenant_id_name_key').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.name.asc().nullsLast(),
    ),
    index('roles_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    index('roles_scope_idx').on(table.scope),
    index('roles_reseller_id_idx').on(table.resellerId),
    ...tenantPolicies('roles'),
  ],
);
