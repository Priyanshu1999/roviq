import { sql } from 'drizzle-orm';
import { pgPolicy, pgRole } from 'drizzle-orm/pg-core';

export const roviqApp = pgRole('roviq_app').existing();
export const roviqReseller = pgRole('roviq_reseller').existing();
export const roviqAdmin = pgRole('roviq_admin').existing();

/**
 * RLS owns **tenant isolation only**. Soft-delete visibility is enforced in
 * the application layer (repositories add `isNull(table.deletedAt)` to reads;
 * `withTrash`/`include_deleted` no longer exist). This keeps soft-delete
 * grep-able, behaves identically across DB roles, and removes the
 * "post-update row invisible to RLS" footgun previously needed during
 * `softDelete()`.
 */

/** Reseller read policy for tenant-scoped tables — sees rows belonging to their institutes */
const resellerTenantRead = (tableName: string) =>
  pgPolicy(`${tableName}_reseller_read`, {
    for: 'select',
    to: roviqReseller,
    using: sql`tenant_id IN (
      SELECT id FROM institutes
      WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
    )`,
  });

/** RLS policies for tenant-scoped tables (have `tenant_id`; soft-delete handled in app layer) */
export const tenantPolicies = (tableName: string) => [
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
  resellerTenantRead(tableName),
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
  resellerTenantRead(tableName),
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
  pgPolicy(`${tableName}_reseller_read`, {
    for: 'select',
    to: roviqReseller,
    using: sql`true`,
  }),
  pgPolicy(`${tableName}_admin_all`, {
    for: 'all',
    to: roviqAdmin,
    using: sql`true`,
    withCheck: sql`true`,
  }),
];

/** RLS policies for entity tables WITHOUT tenantId (e.g., institutes, EE billing) */
export const entityPolicies = (tableName: string) => [
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
    using: sql`true`,
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
