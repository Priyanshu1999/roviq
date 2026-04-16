# Architecture

## Monorepo Structure

```
roviq/
├── apps/
│   ├── api-gateway/          # NestJS — GraphQL API entry point
│   │   └── src/
│   │       ├── admin/            # Platform-scope resolvers (@PlatformScope)
│   │       │   ├── institute/    # Admin institute CRUD, lifecycle, statistics
│   │       │   └── reseller/     # Admin reseller management
│   │       ├── reseller/         # Reseller-scope resolvers (@ResellerScope)
│   │       │   ├── institute/    # Reseller institute requests, suspend/reactivate
│   │       │   └── institute-group/  # Reseller group management
│   │       ├── institute/        # Institute-scope resolvers (@InstituteScope)
│   │       │   ├── management/   # Institute CRUD, branding, config
│   │       │   ├── standard/     # Grade levels
│   │       │   ├── section/      # Class sections
│   │       │   ├── subject/      # Subjects & curriculum
│   │       │   └── setup/        # Temporal InstituteSetupWorkflow
│   │       ├── academic-year/    # Academic year lifecycle
│   │       ├── institute-group/  # Institute group CRUD
│   │       ├── auth/             # JWT, login, impersonation
│   │       ├── audit/            # Audit logging + Temporal partition workflow
│   │       └── common/           # Pagination, pubsub, event bus
│   └── web/                  # Next.js 16 — unified web app (admin/reseller/institute)
├── libs/
│   ├── shared/
│   │   └── common-types/     # @roviq/common-types — CASL, AuthUser, ErrorCodes, events
│   ├── database/             # @roviq/database — Drizzle schema, RLS, tenant helpers
│   │   ├── src/schema/       # Table definitions organized by domain
│   │   ├── migrations/       # Custom SQL migrations (FORCE RLS, GRANTs, indexes)
│   │   └── seed/board-catalogs/  # CBSE/BSEH/RBSE subject seed data (JSON)
│   ├── backend/
│   │   ├── auth/             # @roviq/auth-backend — scope guards, JWT strategy
│   │   ├── casl/             # @roviq/casl — ability factory, guards, decorators
│   │   ├── nats-jetstream/   # @roviq/nats-jetstream — NATS JetStream client
│   │   └── telemetry/        # @roviq/telemetry — OpenTelemetry, Pino logger
│   └── frontend/
│       ├── auth/             # @roviq/auth — React auth context, login
│       ├── graphql/          # @roviq/graphql — Apollo Client, codegen
│       ├── i18n/             # @roviq/i18n — next-intl, formatting
│       └── ui/               # @roviq/ui — shadcn/ui components
├── ee/                       # Enterprise Edition (billing, payment gateways)
├── e2e/
│   └── api-gateway-e2e/      # E2E tests (Hurl + Vitest)
├── scripts/
│   ├── seed.ts               # Test data seeder
│   ├── seed-ids.ts           # Deterministic UUIDs for seeding
│   └── db-reset.ts           # Drop + push + FORCE RLS + GRANTs + seed
└── docs/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, GraphQL (Apollo Server 5), Drizzle ORM v1 |
| Frontend | Next.js 16 (App Router, Turbopack), React 19 |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, next-intl, date-fns |
| Auth | JWT (argon2id), Passport, @casl/ability |
| Database | PostgreSQL 18 with Row Level Security |
| Cache | Redis 7 (ioredis) |
| Messaging | NATS 2.10 JetStream |
| Monorepo | NX 22, pnpm, Biome |
| Testing | Vitest 4, @nx/vitest |

## Key Design Decisions

### Multi-Tenancy: RLS over Schema-per-Tenant
- PostgreSQL Row Level Security on all tenant-scoped tables
- `app.current_tenant_id` session variable set via `withTenant()` helper
- Policy-based admin bypass: `roviq_admin` does NOT have `BYPASSRLS`. Instead, policies explicitly grant `roviq_admin` access via `FOR ALL USING (true) WITH CHECK (true)`.
- `FORCE ROW LEVEL SECURITY` on every table — without it, the table owner bypasses policies silently.
- `institutes` table has custom RLS: `roviq_app` gets SELECT only (read own institute), `roviq_reseller` gets FOR ALL (GRANTs limit to SELECT + INSERT + UPDATE), `roviq_admin` gets full access.

### Platform vs Tenant Tables
- **Platform-level (custom RLS):** `users`, `institutes`, `institute_groups`, `resellers` — have per-role policies instead of tenant-scoped policies
- **Tenant-scoped (RLS via `tenantPolicies()`):** `memberships`, `profiles`, `roles`, `refresh_tokens`, `student_guardians`, `academic_years`, `standards`, `sections`, `subjects`, `institute_branding`, `institute_configs`, `institute_identifiers`, `institute_affiliations`, and all business data
- Membership links User↔Institute. One user can have memberships in multiple institutes.

### Three DB Contexts
- **`withTenant(db, tenantId, fn)`**: sets `SET LOCAL ROLE roviq_app` + `app.current_tenant_id`. Used for institute-scope operations.
- **`withReseller(db, resellerId, fn)`**: sets `SET LOCAL ROLE roviq_reseller` + `app.current_reseller_id`. Used for reseller-scope operations.
- **`withAdmin(db, fn)`**: sets `SET LOCAL ROLE roviq_admin`. Used for platform admin operations and cross-tenant queries.

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

### Event Architecture
- **EventBusService**: publishes to both NATS JetStream (for cross-service) and GraphQL PubSub (for subscriptions) in a single `emit()` call
- **GraphQL Subscriptions**: 8 subscriptions across 3 scopes with tenant/reseller filtering via `graphql-ws`
- **Temporal**: used for long-running workflows (institute setup pipeline, audit partition management)

### Service Layer Rules
- Services ONLY talk to repositories — never import `DRIZZLE_DB`, `withAdmin`, or Drizzle tables
- Services return repository `Record` types — GraphQL handles mapping via `@ObjectType` decorators
- Each status transition is a named domain mutation (`suspend()`, not `updateStatus('SUSPENDED')`)
- `BusinessException` with `ErrorCode` enum for all business errors (not generic `BadRequestException`)

### Institute Service
See `docs/institute-service.md` for full documentation of the institute module including schema, resolvers, RLS, events, and Temporal workflow.

## Date & timezone contract

| Layer | Format | Notes |
| --- | --- | --- |
| PostgreSQL storage | `date` (YYYY-MM-DD) / `timestamptz` (RFC 3339 UTC) | Drizzle maps `date` ↔ `string`, `timestamp` ↔ `Date` |
| GraphQL wire | `DateOnly` scalar (YYYY-MM-DD) / `DateTime` scalar (RFC 3339) | `graphql-scalars` `GraphQLLocalDate` / `GraphQLDateTimeISO` |
| Frontend display | Indian locale (DD/MM/YYYY) via `useFormatDate()` from `@roviq/i18n` | Never format in resolvers or services |
| Institute-timezone calendar | `getInstituteToday(institute)` from `@roviq/common/timezone` | Falls back to `Asia/Kolkata` |

**The DD/MM footgun**: India displays DD/MM/YYYY. ISO stores YYYY-MM-DD. These must never be confused — store ISO, parse ISO, display via hook. A display string must never be re-parsed as a date.
