import { integer, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Auth/platform tables — no soft delete, no tenant */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};

/** Tables that track who created/updated — extends timestamps */
export const trackingColumns = {
  ...timestamps,
  createdBy: uuid('created_by').notNull(),
  updatedBy: uuid('updated_by').notNull(),
};

/** Full entity columns — tracking + soft delete + optimistic concurrency */
export const entityColumns = {
  ...trackingColumns,
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
  version: integer('version').default(1).notNull(),
};

/** Tenant-scoped business tables — most common spread */
export const tenantColumns = {
  tenantId: uuid('tenant_id').notNull(),
  ...entityColumns,
};

/**
 * Type-safe multi-language JSONB column.
 * Stored as `{ "en": "Science", "hi": "विज्ञान" }`
 */
export const i18nText = (columnName: string) => jsonb(columnName).$type<Record<string, string>>();
