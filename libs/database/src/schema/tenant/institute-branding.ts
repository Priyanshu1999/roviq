import { sql } from 'drizzle-orm';
import { foreignKey, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

export const instituteBranding = pgTable(
  'institute_branding',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    primaryColor: text('primary_color'),
    secondaryColor: text('secondary_color'),
    themeIdentifier: text('theme_identifier'),
    coverImageUrl: text('cover_image_url'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('institute_branding_tenant_id_key')
      .on(table.tenantId)
      .where(sql`${table.deletedAt} IS NULL`),
    ...tenantPolicies('institute_branding'),
  ],
);
