import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { entityColumns, i18nText } from '../common/columns';
import { instituteStatus } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';

export const institutes = pgTable(
  'institutes',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: i18nText('name').notNull(),
    slug: text().notNull(),
    logoUrl: text('logo_url'),
    timezone: text().default('Asia/Kolkata').notNull(),
    currency: text().default('INR').notNull(),
    settings: jsonb().default({}).notNull(),
    status: instituteStatus().default('ACTIVE').notNull(),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('institutes_slug_key').using('btree', table.slug.asc().nullsLast()),
    ...entityPolicies('institutes'),
  ],
);
