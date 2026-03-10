# Libs Reorganization Design

## Problem

All 7 libs sit flat under `libs/`. Backend modules (casl, prisma DI, redis) live inside `apps/api-gateway/src/` instead of being reusable libs. As the project grows with more backend services, these modules need to be shareable.

## Decision

Reorganize `libs/` into three layer-based subdirectories and extract reusable backend modules from the gateway into proper NX libraries.

## Target Structure

```
libs/
├── shared/
│   └── common-types/            # CASL types shared by backend + frontend
│
├── backend/
│   ├── prisma-client/           # Prisma schema, generated client, tenant extensions
│   ├── nestjs-prisma/           # NestJS DI modules for Prisma (new lib, from api-gateway)
│   ├── casl/                    # Ability factory, guard, decorators (new lib, from api-gateway)
│   ├── redis/                   # NestJS DI module for ioredis (new lib, from api-gateway)
│   └── nats-utils/              # NATS JetStream publish/subscribe wrappers
│
└── frontend/
    ├── auth/                    # React auth context, JWT decode, login form
    ├── graphql/                 # Apollo Client setup
    ├── i18n/                    # next-intl config, routing, formatting
    └── ui/                      # shadcn/ui components, layout
```

## Import Paths

Flat `@roviq/*` paths — folder grouping is organizational, not reflected in import paths.

| Path | Filesystem | Type |
|------|-----------|------|
| `@roviq/common-types` | `libs/shared/common-types/` | folder move |
| `@roviq/prisma-client` | `libs/backend/prisma-client/` | folder move |
| `@roviq/nats-utils` | `libs/backend/nats-utils/` | folder move |
| `@roviq/ui` | `libs/frontend/ui/` | folder move |
| `@roviq/auth` | `libs/frontend/auth/` | folder move |
| `@roviq/graphql` | `libs/frontend/graphql/` | folder move |
| `@roviq/i18n` | `libs/frontend/i18n/` | folder move |
| `@roviq/casl` | `libs/backend/casl/` | new lib |
| `@roviq/nestjs-prisma` | `libs/backend/nestjs-prisma/` | new lib |
| `@roviq/redis` | `libs/backend/redis/` | new lib |

## What Stays in api-gateway

- `src/auth/` — JWT strategy, Passport guards, login/signup resolvers, auth service. This is gateway-specific; microservices receive authenticated context via NATS headers.
- `src/casl/current-ability.decorator.ts` — Uses `GqlExecutionContext`, kept in gateway but imports from `@roviq/casl`.

## What Changes

- `tsconfig.base.json` — update path aliases to new folder locations
- `apps/api-gateway/src/app/app.module.ts` — import from `@roviq/casl`, `@roviq/nestjs-prisma`, `@roviq/redis`
- `apps/api-gateway/src/auth/` — update relative imports to use lib paths
- Each new lib gets `project.json`, `tsconfig.json`, `tsconfig.lib.json`, `src/index.ts`

## What Does NOT Change

- No logic changes in any file
- No import path changes for existing `@roviq/*` consumers in apps
- Backend auth stays in api-gateway
- NX project names stay clean (e.g., `casl`, `nestjs-prisma`, `redis`)

## Rejected Alternatives

1. **Grouped import paths** (`@roviq/backend/casl`) — rejected because it makes imports longer, breaks all existing imports, and couples import paths to organizational decisions that may change.
2. **Single `@roviq/backend-core` bundle** — rejected because coarser boundaries make it harder to use selectively.
3. **Minimal move (only prisma/redis)** — rejected because it doesn't match the target structure and leaves casl stuck in the gateway.
