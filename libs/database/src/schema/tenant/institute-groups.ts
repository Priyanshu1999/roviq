import { sql } from 'drizzle-orm';
import { foreignKey, jsonb, pgPolicy, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { entityColumns } from '../common/columns';
import { groupStatus, groupType } from '../common/enums';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import type { InstituteAddress, InstituteContact } from './institutes';

export const instituteGroups = pgTable(
  'institute_groups',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    name: text().notNull(),
    code: text().notNull(),
    type: groupType().notNull(),
    registrationNumber: text('registration_number'),
    registrationState: text('registration_state'),
    contact: jsonb().$type<InstituteContact>().default({ phones: [], emails: [] }).notNull(),
    address: jsonb().$type<InstituteAddress>(),
    status: groupStatus().default('ACTIVE').notNull(),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('institute_groups_code_key').on(table.code).where(sql`${table.deletedAt} IS NULL`),

    // FK: createdBy → users.id (from entityColumns)
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'institute_groups_created_by_users_id_fkey',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    // ── RLS policies (platform-level entity, no tenant_id) ──

    // roviq_admin: full access
    pgPolicy('institute_groups_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // roviq_reseller: read groups containing their institutes
    pgPolicy('institute_groups_reseller_read', {
      for: 'select',
      to: roviqReseller,
      using: sql`id IN (
        SELECT group_id FROM institutes
        WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
          AND group_id IS NOT NULL
      )`,
    }),

    // roviq_app: read own institute's group
    pgPolicy('institute_groups_app_select', {
      for: 'select',
      to: roviqApp,
      using: sql`id = (
        SELECT group_id FROM institutes
        WHERE id = current_setting('app.current_tenant_id', true)::uuid
      )`,
    }),

    // roviq_app: no insert/update/delete — platform admins only
    pgPolicy('institute_groups_app_insert', {
      for: 'insert',
      to: roviqApp,
      withCheck: sql`false`,
    }),
    pgPolicy('institute_groups_app_update', {
      for: 'update',
      to: roviqApp,
      using: sql`false`,
    }),
    pgPolicy('institute_groups_app_delete', {
      for: 'delete',
      to: roviqApp,
      using: sql`false`,
    }),
  ],
);
