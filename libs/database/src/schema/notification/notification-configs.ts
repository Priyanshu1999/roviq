import { boolean, foreignKey, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { organizations } from '../tenant/organizations';

export const instituteNotificationConfigs = pgTable(
  'institute_notification_configs',
  {
    id: uuid().defaultRandom().primaryKey(),
    notificationType: text('notification_type').notNull(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    whatsappEnabled: boolean('whatsapp_enabled').default(true).notNull(),
    emailEnabled: boolean('email_enabled').default(true).notNull(),
    pushEnabled: boolean('push_enabled').default(false).notNull(),
    digestEnabled: boolean('digest_enabled').default(false).notNull(),
    digestCron: text('digest_cron'),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [organizations.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('institute_notification_configs_tenant_id_notification_type_key').using(
      'btree',
      table.tenantId.asc().nullsLast(),
      table.notificationType.asc().nullsLast(),
    ),
    index('institute_notification_configs_tenant_id_idx').using(
      'btree',
      table.tenantId.asc().nullsLast(),
    ),
    ...tenantPolicies('institute_notification_configs'),
  ],
);
