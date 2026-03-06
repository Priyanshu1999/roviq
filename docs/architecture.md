# Architecture

## Monorepo Structure

```
roviq/
├── apps/
│   ├── api-gateway/          # NestJS — GraphQL API entry point
│   ├── institute-service/    # NestJS — institute business logic
│   ├── admin-portal/         # Next.js — platform admin UI
│   └── institute-portal/     # Next.js — institute-facing UI
├── libs/
│   ├── prisma-client/        # @roviq/prisma-client — Prisma + RLS extensions
│   ├── common-types/         # @roviq/common-types — shared CASL types
│   ├── nats-utils/           # @roviq/nats-utils — messaging wrappers
│   ├── ui/                   # @roviq/ui — shadcn/ui components + layout
│   ├── graphql/              # @roviq/graphql — Apollo Client setup
│   ├── auth/                 # @roviq/auth — frontend auth context
│   └── i18n/                 # @roviq/i18n — next-intl config, routing, formatting
├── e2e/
│   └── api-gateway-e2e/      # E2E tests for API gateway
├── scripts/
│   ├── init-db.sh            # PostgreSQL role setup (runs in Docker)
│   └── seed.ts               # Test data seeder
└── docs/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, GraphQL (Apollo Server 5), Prisma 7 |
| Frontend | Next.js 16 (App Router, Turbopack), React 19 |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, next-intl, date-fns |
| Auth | JWT (argon2id), Passport, @casl/ability |
| Database | PostgreSQL 16 with Row Level Security |
| Cache | Redis 7 (ioredis) |
| Messaging | NATS 2.10 JetStream |
| Monorepo | NX 22, Bun, Biome |
| Testing | Vitest 4, @nx/vitest |

## Key Design Decisions

### Multi-Tenancy: RLS over Schema-per-Tenant
- PostgreSQL Row Level Security on all tenant-scoped tables
- `app.current_tenant_id` session variable set via Prisma Client Extension
- Policy-based admin bypass: `roviq_admin` does NOT have `BYPASSRLS`. Instead, `createAdminClient()` sets `app.is_platform_admin = 'true'` and each tenant-scoped table has an `admin_platform_access` policy that checks this variable.
- `organizations` table has no RLS (it is the tenant registry)

### Platform vs Tenant Tables
- **Platform-level (no RLS):** `users`, `phone_numbers`, `auth_providers` — User is a global identity with unique username/email
- **Tenant-scoped (RLS):** `memberships`, `profiles`, `roles`, `refresh_tokens`, `student_guardians`, and all business data
- Membership links User↔Organization. One user can have memberships in multiple organizations.

### Two Prisma Clients
- **Tenant client**: sets `SET LOCAL app.current_tenant_id` before every query. Used for tenant-scoped operations within `tenantContext.run()`.
- **Admin client**: sets `app.is_platform_admin = 'true'` before every query, enabling the `admin_platform_access` RLS policy. Used for auth (user lookup at login is platform-level) and platform admin operations.

### CASL Authorization
- Role abilities stored as JSON in the `roles` table, cached in Redis (5min TTL)
- Per-membership ability overrides in `memberships.abilities` field
- Condition placeholders (`${user.id}`, `${user.tenantId}`) resolved at request time
- Same `AppAction`/`AppSubject` types shared between backend and frontend via `@roviq/common-types`

### NestJS Build: @nx/js:tsc (not webpack)
- NestJS apps use `@nx/js:tsc` executor for builds
- Next.js apps use Turbopack via `@nx/next/plugin`
- No webpack anywhere in the workspace

### GraphQL Schema: In-Memory
- `autoSchemaFile: true` — schema generated in memory, no file written to disk
- Avoids file watcher loops with NX dev server
