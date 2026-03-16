import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { gatewayConfigStatus, paymentProvider } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';

export const paymentGatewayConfigs = pgTable(
  'payment_gateway_configs',
  {
    id: uuid().defaultRandom().primaryKey(),
    instituteId: uuid('institute_id')
      .notNull()
      .references(() => institutes.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    provider: paymentProvider().notNull(),
    status: gatewayConfigStatus().default('ACTIVE').notNull(),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('payment_gateway_configs_institute_id_key').using(
      'btree',
      table.instituteId.asc().nullsLast(),
    ),
    ...entityPolicies('payment_gateway_configs'),
  ],
);
