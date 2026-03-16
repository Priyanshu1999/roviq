import { foreignKey, index, jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { membershipStatus } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { organizations } from './organizations';
import { roles } from './roles';

export const memberships = pgTable(
  'memberships',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    abilities: jsonb().default([]),
    status: membershipStatus().default('ACTIVE').notNull(),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [organizations.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    uniqueIndex('memberships_user_id_tenant_id_key').using(
      'btree',
      table.userId.asc().nullsLast(),
      table.tenantId.asc().nullsLast(),
    ),
    index('memberships_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    index('memberships_tenant_id_role_id_idx').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.roleId.asc().nullsLast(),
    ),
    ...tenantPolicies('memberships'),
  ],
);
