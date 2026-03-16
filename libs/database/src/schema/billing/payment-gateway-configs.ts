import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { entityColumns } from '../common/columns';
import { gatewayConfigStatus, paymentProvider } from '../common/enums';
import { entityPolicies } from '../common/rls-policies';
import { organizations } from '../tenant/organizations';

export const paymentGatewayConfigs = pgTable(
  'payment_gateway_configs',
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    provider: paymentProvider().notNull(),
    status: gatewayConfigStatus().default('ACTIVE').notNull(),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('payment_gateway_configs_organization_id_key').using(
      'btree',
      table.organizationId.asc().nullsLast(),
    ),
    ...entityPolicies('payment_gateway_configs'),
  ],
);
