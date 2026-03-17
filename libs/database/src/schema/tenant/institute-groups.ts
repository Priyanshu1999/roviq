import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { entityColumns } from '../common/columns';
import { groupStatus, groupType } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';

export const instituteGroups = pgTable(
  'institute_groups',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    code: text().notNull(),
    type: groupType().notNull(),
    registrationNo: text('registration_no'),
    registrationState: text('registration_state'),
    contact: jsonb().default({ phones: [], emails: [] }).notNull(),
    address: jsonb(),
    status: groupStatus().default('ACTIVE').notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('institute_groups_code_key').on(table.code).where(sql`${table.deletedAt} IS NULL`),
    ...entityPolicies('institute_groups'),
  ],
);
