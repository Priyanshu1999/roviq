import { entityColumns, resellers, roviqAdmin, roviqReseller } from '@roviq/database';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgPolicy, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { gatewayConfigStatus } from './enums';

export const gatewayConfigs = pgTable(
  'payment_gateway_configs',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    resellerId: uuid('reseller_id')
      .notNull()
      .references(() => resellers.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: varchar({ length: 50 }).notNull(),
    status: gatewayConfigStatus().default('ACTIVE').notNull(),
    displayName: varchar('display_name', { length: 255 }),
    isDefault: boolean('is_default').default(false).notNull(),
    /** AES-256-GCM encrypted blob — NEVER log or return in API responses */
    credentials: jsonb(),
    /** Encrypted webhook verification secret */
    webhookSecret: text('webhook_secret'),
    testMode: boolean('test_mode').default(false).notNull(),
    supportedMethods: jsonb('supported_methods').default([]).notNull(),
    ...entityColumns,
  },
  (table) => [
    index('gwc_reseller_id_idx').on(table.resellerId),
    index('gwc_reseller_provider_idx').on(table.resellerId, table.provider),
    // Reseller: full CRUD on own gateway configs (live rows)
    pgPolicy('gwc_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid AND deleted_at IS NULL`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // NO roviq_app policy — institute users must NEVER see gateway credentials
    // Admin: break-glass full access
    pgPolicy('gwc_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
