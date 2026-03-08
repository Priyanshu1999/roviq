# Quick Mistake Reference

| Don't | Do |
|-------|-----|
| Raw `PrismaClient` for tenant data | `TenantPrismaClient` |
| `adminPrisma` typed as `PrismaClient` | `AdminPrismaClient` from `@roviq/prisma-client` |
| `BYPASSRLS` on DB roles | Policy-based bypass (`app.is_platform_admin`) |
| `adminPrisma` for tenant-scoped queries | `TenantPrismaClient` (RLS) |
| RLS migration without admin policy | Include `admin_platform_access` policy |
| `User.abilities` | `Membership.abilities` (abilities live on Membership) |
| `$transaction` | `tenantTransaction()` |
| `if (role === 'teacher')` | `ability.can()` |
| `js.publish()` | `publish()` from nats-utils |
| "school" | "institute" |
| npm/bun/npx | pnpm/pnpx |
| ESLint/Prettier | Biome |
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
| Commit without running pre-commit gate | Run lint, typecheck, test, e2e THEN ask to commit |
| Commit without asking | Always ask first |
| Writing docs/assertions from memory | Verify against actual source code before writing |
