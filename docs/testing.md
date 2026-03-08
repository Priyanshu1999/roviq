# Testing

## Setup

Tests use Vitest 4 integrated with NX via `@nx/vitest` plugin. Each project with a `vitest.config.ts` automatically gets a `test` target. E2E projects under `e2e/` get an `e2e` target.

## Commands

```bash
# Unit tests
nx run-many -t test              # all projects
nx run api-gateway:test          # single project
nx affected -t test              # only changed projects

# E2E tests (requires running infrastructure)
pnpm run e2e                  # all e2e projects
pnpm run e2e:gateway          # API gateway (Vitest, hits GraphQL API)
pnpm run e2e:admin-portal     # Admin portal (Playwright, browser tests)
pnpm run e2e:institute-portal # Institute portal (Playwright, browser tests)

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
e2e/api-gateway-e2e/                   # Full auth flow against live GraphQL API (Vitest)
e2e/admin-portal-e2e/                  # Admin portal browser tests (Playwright)
e2e/institute-portal-e2e/              # Institute portal browser tests (Playwright)
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

All e2e tests require dev environment running (`tilt up`) with database migrated and seeded (`pnpm run db:migrate:dev && pnpm run db:seed`).

### API Gateway (Vitest)

Hits the live GraphQL API at `http://localhost:3000/api/graphql`.

Coverage:
- Login: multi-org (platformToken + memberships), single-org (direct accessToken), wrong password, non-existent user
- selectOrganization: manage-all abilities for institute_admin, limited for teacher, condition placeholders resolved for student, rejected without token, rejected for wrong tenant
- `me` query: valid token, missing token, invalid token
- Refresh: token rotation, reused token rejection
- Logout: success, refresh token invalidation after logout

### Admin Portal & Institute Portal (Playwright)

Browser tests against admin portal (`http://localhost:4200`) and institute portal (`http://localhost:4300`). Each project has a `playwright.config.ts` using `nxE2EPreset` with a `webServer` command that auto-starts the portal if not already running. The `e2e` target is defined explicitly in `project.json`.

Coverage:
- Login form rendering (title, description, inputs, button)
- Validation errors on empty submission
- Error display for invalid credentials
- Single-org user (teacher1) login → dashboard redirect
- Multi-org user (admin) login → org picker with both institutes
- Multi-org user selects org → dashboard redirect

## Adding Tests

**Unit tests:** Create `__tests__/your-file.test.ts` in the relevant project. The project's `vitest.config.ts` picks it up automatically. NX caches results — only re-runs when source files change.

**API e2e:** Add tests to `e2e/api-gateway-e2e/` with Vitest.

**Portal e2e:** Add `*.spec.ts` files under `e2e/<app>-e2e/src/`. For a new portal e2e project, create `e2e/<name>-e2e/playwright.config.ts` + `project.json` with explicit `e2e` target and `implicitDependencies`.
