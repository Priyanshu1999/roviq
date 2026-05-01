---
name: drizzle-database
description: Use when working with database schema, Drizzle ORM, migrations, RLS policies, tenant isolation queries, withTenant/withAdmin wrappers, soft-delete via *_live views, or any code in libs/database — covers Drizzle v1 beta conventions, column helpers, soft delete, status enums, and migration commands
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

#### Database roles & connection mapping

- Three database roles: `roviq` (superuser, migrations only), `roviq_app` (runtime, RLS enforced), `roviq_admin` (admin, policy-based bypass)
- `DATABASE_URL` uses `roviq_pooler` which assumes `roviq_app` at runtime, `DATABASE_URL_ADMIN` uses `roviq_admin`, `DATABASE_URL_MIGRATE` uses `roviq` superuser
- RLS bypass is policy-based, NOT role-level — no runtime role has `BYPASSRLS`
- Connection flow: `roviq_pooler` (NOINHERIT LOGIN) → assumes `roviq_app`/`roviq_reseller`/`roviq_admin` via `SET LOCAL ROLE` inside wrappers

#### Query wrappers

- Single Drizzle instance (DRIZZLE_DB), not separate admin/tenant instances
- Tenant queries: wrap in `withTenant(db, tenantId, async (tx) => {...})`
- Admin queries: wrap in `withAdmin(db, async (tx) => {...})`
- Reseller queries: wrap in `withReseller(db, resellerId, async (tx) => {...})`
- `withTenant` sets `app.current_tenant_id` via SET LOCAL — does NOT read from ALS
- `withAdmin` sets `ROLE roviq_admin` via SET LOCAL — `roviq_admin` policy is `USING (true)` for cross-tenant ops
- **`withTrash` no longer exists.** Soft-delete visibility moved out of RLS — see "Soft delete" below.

#### RLS policies

- RLS policies defined via `tenantPolicies(name)` or `entityPolicies(name)` helpers
- NEVER write inline policy SQL per table — always use the helpers
- `pgRole('roviq_app').existing()` and `pgRole('roviq_admin').existing()` for policy `to` targets
- Hard DELETE blocked for `roviq_app` — policy `USING (false)`. Only `roviq_admin` can hard delete

#### Platform vs Tenant tables

- **Platform-level (NO RLS):** `users`, `institutes`, `phone_numbers`, `auth_providers` — use `withAdmin(db, fn)`
- **Tenant-scoped (RLS enforced):** `memberships`, `profiles`, `roles`, `refresh_tokens`, `student_guardians`, and all business data — use `withTenant(db, tenantId, fn)`
- Exception: `withAdmin()` for platform admin cross-tenant ops and auth service (user lookup at login)

#### Schema change checklist (tenant-scoped tables)

Every tenant-scoped table MUST have ALL of these:

- `tenantId: uuid('tenant_id').notNull()` — use `tenantColumns` spread for standard tables
- Index on `tenant_id` — without this, RLS does full table scans
- RLS policies via `tenantPolicies('table_name')` helper (includes tenant isolation + admin bypass + soft-delete filter)

After ANY schema change:

- Run `tilt trigger db-push` to sync schema to DB
- Update `scripts/seed.ts` to match the new schema
- Grep for old field names / unique constraints across `scripts/`, `e2e/`, and test files

### CASL authorization

- Dynamic roles — abilities stored in DB, not hardcoded
- Abilities live on `Membership`, NOT `User` — each membership has a personal `abilities` field combined with role abilities per request
- AbilityFactory reads from `Membership.abilities`
- Use CASL guards and decorators:

```typescript
@UseGuards(GqlAuthGuard, AbilityGuard)
@CheckAbility({ action: 'create', subject: 'Attendance' })
```

- NEVER hardcode role checks — `if (user.role === 'teacher')` is banned; use `ability.can()` instead
- `GqlAuthGuard` comes from `@roviq/auth-backend`, NOT from `@roviq/casl`
- CASL lives in `@roviq/casl` (`libs/backend/casl/`) — authorization only, not authentication

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

- **Visibility lives in `<table>_live` security_invoker views** — NOT in RLS, NOT in service-level `isNull(deletedAt)` predicates. Every soft-deletable table has a corresponding `<table>Live` export from `@roviq/database` (e.g. `subjects`/`subjectsLive`, `studentProfiles`/`studentProfilesLive`). Reads MUST use the `*Live` view; writes target the base table.
- The view is created `WITH (security_invoker = true)` so SELECT runs RLS as the calling DB role — without that, the view runs as its owner and would leak rows across tenants. PG 15+ feature; PG 18 inlines the view with the partial index for free.
- INSERT/UPDATE/DELETE … RETURNING must hit the **base table** — Drizzle pgViews are read-only. Repository pattern: a `liveColumns` projection (read) + a `writeReturning` projection (insert/update return).
- NEVER use `db.delete()` — always `softDelete(db, table, id)` which throws `NotFoundException` directly. Helper sits in `@roviq/database` and is now a plain UPDATE (the old `withTrashFlag` dance is gone).
- Restore: `restoreDeleted(db, table, id)` — caller looks up the row through the **base table** (no view filter) and the helper clears `deletedAt`/`deletedBy`.
- Trash listings (admin recycle bin, audit cross-tenant break-glass): query the base table directly with an explicit `isNull(table.deletedAt)` opposite (`isNotNull(...)`). Don't reach for the view.
- Lint guard: `pnpm check:live-views` (script at `scripts/check-live-views.ts`) fails CI when application code reads a soft-deletable base table outside `__tests__/`. Annotate intentional cases with `// allow-base-read: <reason>`.
- `notDeleted(table)` helper (also in `@roviq/database`) returns `isNull(table.deletedAt)` for the rare case a query needs to combine "live" with another table without its own view.
- **`withTrash()` no longer exists.** It was removed when soft-delete moved out of RLS — there's nothing left to toggle.

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

### Time-RANGE partitioned tables

Static `CREATE TABLE foo_YYYY_MM PARTITION OF foo` lists silently break the day wall-clock crosses the last upper bound — production and tests both. Use `ensure_monthly_partition(parent regclass, month_start timestamptz)` (installed by `20260501033334_ensure-monthly-partition`) and wire all three sites — skipping any one re-introduces the drift:

- **Create migration**: backfill with `SELECT ensure_monthly_partition('foo'::regclass, gs) FROM generate_series(date_trunc('month', NOW()), date_trunc('month', NOW()) + interval '6 months', interval '1 month') gs;`
- **App boot + daily**: add an `OnModuleInit` provider on the dedicated pool. Pattern: `apps/api-gateway/src/audit/audit-partition-maintainer.ts`. Boot alone misses long-lived pods.
- **`scripts/db-reset.ts`**: append to `PARTITIONED_TABLES` in `ensureMonthlyPartitions()` so dev/e2e/integration DBs share the buffer.

### Gotchas

- `drizzle-kit push` does NOT diff RLS policies — it skips them. Drop+recreate schema for clean policy state
- `.enableRLS()` only does `ENABLE`, not `FORCE`. Apply `FORCE ROW LEVEL SECURITY` via raw SQL in custom migrations
- Renamed RLS policies cause `drizzle-kit generate` interactive prompts. Use consistent naming or ask user to reset DB
- PostgreSQL prepared statements reject multi-command strings in a single `tx.execute()`. Use separate `await tx.execute()` calls for each statement
- Reseller-scoped queries: wrap in `withReseller(db, resellerId, async (tx) => {...})` — sets reseller context for RLS

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
