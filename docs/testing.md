# Testing

## Setup

Tests use Vitest 4 integrated with NX via `@nx/vitest` plugin. Each project with a `vitest.config.ts` automatically gets a `test` target. E2E projects under `e2e/` get an `e2e` target.

## Commands

```bash
# Unit tests
nx run-many -t test              # all projects
nx run api-gateway:test          # single project
nx affected -t test              # only changed projects

# E2E tests (requires running API gateway + infrastructure)
nx run api-gateway-e2e:e2e

# All tests
nx run-many -t test e2e

# Watch mode (single project)
nx run api-gateway:test --watch
```

## Test Structure

```
libs/common-types/src/__tests__/       # CASL types, role ability definitions
libs/auth/src/__tests__/               # JWT decode, token expiry logic
libs/prisma-client/src/__tests__/      # Tenant ID validation, AsyncLocalStorage isolation
libs/nats-utils/src/__tests__/         # Circuit breaker, stream definitions
apps/api-gateway/src/auth/__tests__/   # AuthService (login, register, refresh, logout)
apps/api-gateway/src/casl/__tests__/   # AbilityFactory (caching, conditions, rule merging)
e2e/api-gateway-e2e/                   # Full auth flow against live API
```

## Unit Tests

Unit tests mock external dependencies (Prisma, Redis, JWT). No running infrastructure needed.

Key coverage:
- **AuthService**: password hashing, token generation, refresh rotation, reuse detection, logout
- **AbilityFactory**: Redis caching, DB fallback, condition placeholder resolution, role+user rule merging
- **JWT decode**: payload extraction, expiry with configurable buffer
- **Tenant extension**: UUID validation, AsyncLocalStorage context isolation
- **Circuit breaker**: creation, registry, failure thresholds, fallbacks

## E2E Tests

E2E tests hit the live GraphQL API at `http://localhost:3000/graphql`. They require:
- Docker infrastructure running (`docker compose up -d`)
- Database migrated and seeded
- API gateway running (`dotenvx run -f .env.development -- nx serve api-gateway`)

Coverage:
- Login with correct/wrong credentials for all roles
- CASL ability rules returned per role (manage-all, limited, conditioned)
- `me` query with valid/invalid/missing token
- Refresh token rotation and reuse detection
- Logout

## Adding Tests

1. Create `__tests__/your-file.test.ts` in the relevant project
2. The project's `vitest.config.ts` picks it up automatically
3. NX caches results — only re-runs when source files change

For new e2e projects, create `e2e/<name>/vitest.config.ts` + `project.json` with `implicitDependencies`.
