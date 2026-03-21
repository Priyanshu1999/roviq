# Quick Mistake Reference

| Don't | Do |
|-------|-----|
| Raw DB queries for tenant data | `withTenant(db, tenantId, fn)` |
| `BYPASSRLS` on DB roles | Policy-based bypass (`app.is_platform_admin`) |
| Direct DB access for platform queries | `withAdmin(db, fn)` (note: bypasses ALL RLS — add explicit `deletedAt IS NULL` filters) |
| RLS migration without admin policy | Include `admin_platform_access` policy |
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
| Nav href `/dashboard` | Sidebar auto-prefixes with locale |
| `process.env.X` in NestJS | `configService.get('X')` |
| New env var without `.env.example` | Always update `.env.example` too |
| Change schema, forget seed/tests | Update `scripts/seed.ts`, `e2e/`, test files |
| Writing docs/assertions from memory | Verify against actual source code before writing |
| New `@roviq/*` lib without vitest alias | Add to `apps/api-gateway/vitest.config.ts` `resolve.alias` too |
| Drizzle `db:push` for RLS policy changes | `db:push` doesn't diff policies. Drop+recreate schema for clean state |
| `FORCE ROW LEVEL SECURITY` via Drizzle | `.enableRLS()` only does `ENABLE`, not `FORCE`. Apply `FORCE` via raw SQL |
| Drizzle `db:generate` interactive prompts | Renamed policies cause interactive prompts. Use consistent naming or ask user to reset db |
