# Quick Mistake Reference

| Don't | Do |
|-------|-----|
| Raw DB queries for tenant data | `withTenant(db, tenantId, fn)` |
| `BYPASSRLS` on DB roles | Policy-based bypass via `roviq_admin` role |
| Direct DB access for platform queries | `withAdmin(db, fn)` (bypasses ALL RLS — add explicit `deletedAt IS NULL` filters) |
| Reseller-scoped queries without context | `withReseller(db, resellerId, fn)` |
| Connect as `roviq_app` directly | Connect as `roviq_pooler` (NOINHERIT), then `SET LOCAL ROLE` via wrappers |
| `isPlatformAdmin` checks | `scope === 'platform'` (from `AuthUser.scope`) |
| `type === 'platform'` token checks | All tokens are `type: 'access'` with `scope` field |
| `GqlAuthGuard` from `@roviq/casl` | `GqlAuthGuard` from `@roviq/auth-backend` |
| `APP_GUARD` for scope isolation | `@PlatformScope()` / `@ResellerScope()` / `@InstituteScope()` at class level |
| `selectInstitute(tenantId)` | `selectInstitute(membershipId)` |
| `login()` mutation | `adminLogin()` / `resellerLogin()` / `instituteLogin()` per scope |
| `User.abilities` | `Membership.abilities` (abilities live on Membership) |
| `$transaction` | `tenantTransaction()` |
| `if (role === 'teacher')` | `ability.can()` |
| `js.publish()` | `JetStreamClient` from `@roviq/nats-jetstream` |
| "school" or "organization" | "institute" (domain), "tenant" (infra) |
| `.graphql` files | Code-first decorators |
| Logic in resolvers | Logic in services |
| Raw `<button>` | `<Button>` from `@roviq/ui` |
| `SET` in SQL | `SET LOCAL` (pool-safe) |
| Push NATS consumers | Pull consumers |
| Manual `tenantId` param | AsyncLocalStorage context |
| Hardcoded UI strings | `useTranslations()` from `next-intl` |
| `new Date().toLocaleDateString()` | `useFormatDate()` from `@roviq/i18n` |
| Nav href `/dashboard` | Include scope prefix: `/admin/dashboard`, `/institute/dashboard` |
| `process.env.X` in NestJS | `configService.get('X')` |
| New env var without `.env.example` | Always update `.env.example` too |
| Change schema, forget seed/tests | Update `scripts/seed.ts`, `e2e/`, test files |
| Writing docs/assertions from memory | Verify against actual source code before writing |
| New `@roviq/*` lib without vitest alias | Add to `apps/api-gateway/vitest.config.ts` `resolve.alias` too |
| Drizzle `db:push` for RLS policy changes | `db:push` doesn't diff policies. Drop+recreate schema for clean state |
| `FORCE ROW LEVEL SECURITY` via Drizzle | `.enableRLS()` only does `ENABLE`, not `FORCE`. Apply `FORCE` via raw SQL |
| Drizzle `db:generate` interactive prompts | Renamed policies cause interactive prompts. Use consistent naming or ask user to reset db |
| Hardcoded Redis key prefixes | Use `REDIS_KEYS` constants from `auth/redis-keys.ts` |
| Impersonation token refresh | Impersonation tokens are non-renewable. No refresh token created. |
| `db:reset` with `DATABASE_URL` (pooler) | `db-reset.ts` always uses `DATABASE_URL_MIGRATE` (superuser) |
| Multiple SQL in one `tx.execute()` | PostgreSQL prepared statements reject multi-command strings. Use separate `await tx.execute()` calls |
| `defaultRandom()` or `gen_random_uuid()` | `.default(sql`uuidv7()`)` (PG 18 native) |
