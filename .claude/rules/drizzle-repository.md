---
# paths:
#   - "apps/**/*repository.ts"
#   - "apps/**/*repository.test.ts"
#   - "ee/apps/**/*repository.ts"
#   - "ee/apps/**/*repository.test.ts"
#   - "libs/database/**"
#   - "ee/libs/database/**"
---

# Database

## Drizzle ORM v1 beta

### Version

- drizzle-orm@beta, drizzle-kit@beta
- NEVER use stable v0.x APIs — we are on v1 beta track

### Critical rules

- ALWAYS `strict: true` in drizzle.config.ts
- NEVER use `drizzle-kit push` on any shared database
- NEVER use `serial()` — use `integer().primaryKey().generatedAlwaysAsIdentity()`
- NEVER use old `relations()` — use `defineRelations()` (RQBv2)
- NEVER pass `{ schema }` to drizzle() — pass `{ schema, relations }`
- NEVER import from `drizzle-zod` — use `drizzle-orm/zod`
- `$onUpdate` is an alias for `$onUpdateFn` — both accept `() => TData | SQL`
- NEVER use `.defaultRandom()` — use `.default(sql`uuidv7()`)` for all UUIDs (PostgreSQL 18 native)

### Three query APIs — know which to use

- `db.query` is RQBv2 (object-based filters, `with:` for relations): `db.query.users.findMany({ with: { posts: true } })`
- `db.select().from(table).where()` is SQL-like (joins, aggregations, raw control)
- `db._query` is legacy RQBv1 (callback-based). NEVER use `db._query`.
- The `with:` option does NOT exist on `db.select()` — that's a compile error
- Complex JOINs do NOT work in `db.query` — use `db.select()` with `.innerJoin()`

### RLS & multi-tenancy

- Single Drizzle instance (DRIZZLE_DB), not separate admin/tenant instances
- Tenant queries: wrap in `withTenant(db, tenantId, async (tx) => {...})`
- Admin queries: wrap in `withAdmin(db, async (tx) => {...})`
- Trash queries: wrap in `withTrash(db, tenantId, async (tx) => {...})` — sets `app.include_deleted=true`
- `withTenant` sets `app.current_tenant_id` via SET LOCAL — does NOT read from ALS
- `withAdmin` sets `ROLE roviq_admin` via SET LOCAL
- RLS policies defined via `tenantPolicies(name)` or `entityPolicies(name)` helpers
- NEVER write inline policy SQL per table — always use the helpers
- `pgRole('roviq_app').existing()` and `pgRole('roviq_admin').existing()` for policy `to` targets
- Hard DELETE blocked for `roviq_app` — policy `USING (false)`. Only `roviq_admin` can hard delete

### Column conventions

- Tenant-scoped business tables: spread `...tenantColumns` (tenantId + timestamps + tracking + soft delete + version)
- Auth/platform tables (users, refresh_tokens, auth_providers): spread `...timestamps` only
- audit_logs: NO common columns — immutable append-only with its own `created_at`
- Billing EE tables: spread `...entityColumns` (like tenantColumns but without tenantId)
- Immutable event tables (payment_events): only `createdAt`, no update/delete columns
- `createdBy`/`updatedBy` — read from `getRequestContext().userId`. `SYSTEM_USER_ID` for automated ops
- `deletedBy` is nullable — only populated on soft delete
- `version` column — used for optimistic concurrency and future sync
- Multi-language text: use `i18nText('column_name')` → jsonb typed as `Record<string, string>`
- For tables with `tenantColumns` spread, add tenant FK via `foreignKey()` in constraints

### Status & deletion — separate concerns

- **NEVER `isActive: boolean()`** — use domain-specific `pgEnum` status. Each entity owns its enum
- **Status ≠ deletion.** Delete = "created by mistake." Deactivate = "still referenced but disabled"
- Separate mutations: `deletePlan` vs `deactivatePlan`. Explicit status transitions, not generic `updateStatus()`
- **Financial records: status only, no delete** — invoices, subscriptions, ledger entries. `cancelSubscription`, `refundInvoice` — never delete
- Status enums per domain: `plan_status`, `user_status`, `membership_status`, `institute_status`, `role_status`, etc.

### Soft delete

- **Automatic via RLS** — `roviq_app` SELECT/UPDATE policies include `deleted_at IS NULL`. NEVER add `.where(isNull(deletedAt))` manually
- NEVER use `db.delete()` — always use `softDelete(db, table, id)` which throws `NotFoundException`/`ConflictException` directly
- `softDelete()` checks FK references via savepoint before soft-deleting — throws `ConflictException` if referenced
- Trash view: `withTrash(db, tenantId, cb)` — tenant-scoped, needs CASL `manage` permission
- Restore: `restoreDeleted(db, table, id)` — must be called inside `withTrash()`

### Schema patterns

- All schema files in libs/database/src/schema/ organized by domain
- Use reusable helpers from common/columns.ts (timestamps, trackingColumns, entityColumns, tenantColumns, i18nText)
- Cross-file references use lazy evaluation: `.references(() => otherTable.id)`
- Barrel export in schema/index.ts must re-export ALL tables (but NOT relations — breaks circular ref)
- Relations in schema/relations.ts using `defineRelations()` — exported separately from main barrel
- EE relations in ee/libs/database/ using `defineRelationsPart()` — merge via `{ ...relations, ...part }`
- drizzle.config.ts `schema` points to barrel `./src/schema/index.ts` (NOT glob `**/*.ts` — causes duplicates)

### Types

- `DrizzleDB` type requires TWO generics: `NodePgDatabase<typeof schema, typeof relations>`
- Without the second generic, `db.query.*` won't have relational query types

### Migration commands

- Generate: `nx run database:db:generate`
- Apply: `nx run database:db:migrate`
- Reset: `pnpm db:reset` (drop all + push) or `pnpm db:reset --seed`
- Check conflicts: `nx run database:db:check`
- Custom migration: `drizzle-kit generate --custom --name=description`
- Migration folder uses v3 structure (folder-per-migration). There is NO `meta/_journal.json` file.

### Testing

- Unit tests: mock DRIZZLE_DB provider with jest/vitest mocks
- Wrap tests with `withTestContext()` from `@roviq/common-types` for request context
- Integration tests: use PGlite for speed, Testcontainers for RLS testing
- The abstract repository pattern means most tests don't touch Drizzle directly
