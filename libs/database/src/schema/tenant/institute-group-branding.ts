import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { entityPolicies } from '../common/rls-policies';
import { instituteGroups } from './institute-groups';

export const instituteGroupBranding = pgTable(
  'institute_group_branding',
  {
    id: uuid().defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => instituteGroups.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    primaryColor: text('primary_color'),
    secondaryColor: text('secondary_color'),
    theme: text(),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('institute_group_branding_group_id_key').on(table.groupId),
    ...entityPolicies('institute_group_branding'),
  ],
);
