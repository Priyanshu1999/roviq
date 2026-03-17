import { boolean, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { timestamps } from '../common/columns';
import { instituteGroups } from './institute-groups';
import { roles } from './roles';

export const groupMemberships = pgTable(
  'group_memberships',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => instituteGroups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('group_memberships_user_group_key').on(table.userId, table.groupId)],
);
