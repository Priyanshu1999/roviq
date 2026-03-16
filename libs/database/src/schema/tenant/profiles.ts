import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { memberships } from './memberships';

export const profiles = pgTable(
  'profiles',
  {
    id: uuid().defaultRandom().primaryKey(),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    type: text().notNull(),
    metadata: jsonb().default({}),
    ...tenantColumns,
  },
  (table) => [
    uniqueIndex('profiles_membership_id_type_key').using(
      'btree',
      table.membershipId.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    index('profiles_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    ...tenantPolicies('profiles'),
  ],
);
