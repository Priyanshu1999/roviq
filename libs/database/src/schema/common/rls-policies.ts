import { sql } from 'drizzle-orm';
import { pgPolicy, pgRole } from 'drizzle-orm/pg-core';

export const roviqApp = pgRole('roviq_app').existing();
export const roviqAdmin = pgRole('roviq_admin').existing();

/** RLS policies for tenant-scoped tables (have `tenant_id` and `deleted_at`) */
export const tenantPolicies = (tableName: string) => [
  pgPolicy(`${tableName}_app_select`, {
    for: 'select',
    to: roviqApp,
    using: sql`
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    `,
  }),
  pgPolicy(`${tableName}_app_select_trash`, {
    for: 'select',
    to: roviqApp,
    using: sql`
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    `,
  }),
  pgPolicy(`${tableName}_app_insert`, {
    for: 'insert',
    to: roviqApp,
    withCheck: sql`
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    `,
  }),
  pgPolicy(`${tableName}_app_update`, {
    for: 'update',
    to: roviqApp,
    using: sql`
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND deleted_at IS NULL
    `,
    withCheck: sql`
      tenant_id = current_setting('app.current_tenant_id', true)::uuid
    `,
  }),
  pgPolicy(`${tableName}_app_delete`, {
    for: 'delete',
    to: roviqApp,
    using: sql`false`,
  }),
  pgPolicy(`${tableName}_admin_all`, {
    for: 'all',
    to: roviqAdmin,
    using: sql`true`,
    withCheck: sql`true`,
  }),
];

/** RLS policies for tenant-scoped tables WITHOUT deletedAt (e.g., refresh_tokens) */
export const tenantPoliciesSimple = (tableName: string) => [
  pgPolicy(`${tableName}_app_select`, {
    for: 'select',
    to: roviqApp,
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
  }),
  pgPolicy(`${tableName}_app_insert`, {
    for: 'insert',
    to: roviqApp,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
  }),
  pgPolicy(`${tableName}_app_update`, {
    for: 'update',
    to: roviqApp,
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
  }),
  pgPolicy(`${tableName}_app_delete`, {
    for: 'delete',
    to: roviqApp,
    using: sql`false`,
  }),
  pgPolicy(`${tableName}_admin_all`, {
    for: 'all',
    to: roviqAdmin,
    using: sql`true`,
    withCheck: sql`true`,
  }),
];

/** RLS policies for immutable/append-only entity tables (no deletedAt, no update) */
export const immutableEntityPolicies = (tableName: string) => [
  pgPolicy(`${tableName}_app_select`, {
    for: 'select',
    to: roviqApp,
    using: sql`true`,
  }),
  pgPolicy(`${tableName}_app_insert`, {
    for: 'insert',
    to: roviqApp,
    withCheck: sql`true`,
  }),
  pgPolicy(`${tableName}_app_update`, {
    for: 'update',
    to: roviqApp,
    using: sql`false`,
  }),
  pgPolicy(`${tableName}_app_delete`, {
    for: 'delete',
    to: roviqApp,
    using: sql`false`,
  }),
  pgPolicy(`${tableName}_admin_all`, {
    for: 'all',
    to: roviqAdmin,
    using: sql`true`,
    withCheck: sql`true`,
  }),
];

/** RLS policies for entity tables WITHOUT tenantId but WITH deletedAt (e.g., EE billing) */
export const entityPolicies = (tableName: string) => [
  pgPolicy(`${tableName}_app_select`, {
    for: 'select',
    to: roviqApp,
    using: sql`deleted_at IS NULL`,
  }),
  pgPolicy(`${tableName}_app_select_trash`, {
    for: 'select',
    to: roviqApp,
    using: sql`
      deleted_at IS NOT NULL
      AND current_setting('app.include_deleted', true) = 'true'
    `,
  }),
  pgPolicy(`${tableName}_app_insert`, {
    for: 'insert',
    to: roviqApp,
    withCheck: sql`true`,
  }),
  pgPolicy(`${tableName}_app_update`, {
    for: 'update',
    to: roviqApp,
    using: sql`deleted_at IS NULL`,
    withCheck: sql`true`,
  }),
  pgPolicy(`${tableName}_app_delete`, {
    for: 'delete',
    to: roviqApp,
    using: sql`false`,
  }),
  pgPolicy(`${tableName}_admin_all`, {
    for: 'all',
    to: roviqAdmin,
    using: sql`true`,
    withCheck: sql`true`,
  }),
];
