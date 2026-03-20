# Testing

## Setup

Tests use Vitest 4 integrated with NX via `@nx/vitest` plugin. Each project with a `vitest.config.ts` automatically gets a `test` target. E2E projects under `e2e/` get an `e2e` target.

## Commands

```bash
# Unit tests
nx run-many -t test              # all projects
nx run api-gateway:test          # single project
nx affected -t test              # only changed projects

# Project-wide tests (doc sync, cross-cutting)
npx vitest run --config tests/vitest.config.ts

# E2E tests — Docker-based (isolated, reproducible)
pnpm run e2e:hurl             # Hurl billing tests (Docker)
pnpm run e2e:vitest           # Vitest GraphQL tests (Docker)
pnpm run e2e:all              # All E2E tests (Docker)
pnpm run e2e:down             # Teardown E2E containers

# E2E tests — local (requires tilt up)
pnpm run e2e:gateway          # API gateway Vitest (hits local API)
pnpm run e2e:admin-portal     # Admin portal Playwright
pnpm run e2e:institute-portal # Institute portal Playwright

# Watch mode (single project)
nx run api-gateway:test --watch
```

## E2E Architecture

```
docker/compose.e2e.yaml
├── postgres (clean roviq_test DB via init-db.sh)
├── nats
├── redis
├── migrate-and-seed (runs drizzle-kit migrate + seed.ts, exits)
├── api-gateway (waits for migrate-and-seed)
├── notification-service (waits for migrate-and-seed)
├── [profile: hurl] hurl-tests
└── [profile: vitest] vitest-e2e
```

One command spins up infra, migrates, seeds, runs tests, and propagates the exit code. No shell scripts needed — Docker Compose profiles handle everything.

### Deterministic Seed Data

`scripts/seed.ts` uses deterministic UUIDs (`SEED_IDS`) so E2E tests can reference entities directly without querying:

| Entity | ID | Credentials |
|---|---|---|
| Demo Institute | `00000000-0000-4000-a000-000000000101` | — |
| Second Institute | `00000000-0000-4000-a000-000000000102` | — |
| Admin user | `00000000-0000-4000-a000-000000000201` | admin / admin123 |
| Teacher user | `00000000-0000-4000-a000-000000000202` | teacher1 / teacher123 |
| Student user | `00000000-0000-4000-a000-000000000203` | student1 / student123 |
| Free plan | `00000000-0000-4000-a000-000000000001` | — |
| Pro plan | `00000000-0000-4000-a000-000000000002` | — |

### What Goes Where

| Test type | Tool | Location | Tests what |
|---|---|---|---|
| HTTP flow (sequential, stateful) | Hurl | `e2e/api-gateway-e2e/hurl/billing/` | Billing CRUD, subscription lifecycle |
| GraphQL queries/mutations | Vitest + fetch | `e2e/api-gateway-e2e/src/` | Auth flows, audit, RLS isolation |
| RLS isolation | Vitest | `e2e/api-gateway-e2e/src/` | Cross-tenant data leakage prevention |
| Audit trail | Vitest | `e2e/api-gateway-e2e/src/` | Mutation → NATS → audit log entry |
| Novu notifications | Hurl | `e2e/api-gateway-e2e/hurl/novu/` | Novu API smoke, login notification flow |
| Paid billing | Hurl | `e2e/api-gateway-e2e/hurl/paid/` | Paid plan assignment, gateway interaction |
| Browser UI | Playwright | `e2e/<app>-e2e/src/` | Login flows, institute picker |

## Test Structure

```
tests/                                        # Project-wide tests (doc sync, cross-cutting validations)
libs/shared/common-types/src/__tests__/       # CASL types, role ability definitions
libs/frontend/auth/src/__tests__/             # JWT decode, token expiry logic
libs/backend/casl/src/__tests__/              # AbilityFactory (caching, conditions, rule merging)
apps/api-gateway/src/auth/__tests__/          # AuthService (login, register, refresh, logout)
e2e/api-gateway-e2e/
├── src/
│   ├── helpers/                              # Shared E2E helpers (gql-client, auth, ws-client)
│   ├── auth.e2e.test.ts                      # Auth flow (login, selectInstitute, refresh, logout)
│   ├── audit.e2e.test.ts                     # Audit pipeline + RLS + immutability
│   └── rls-isolation.e2e.test.ts             # Cross-tenant data isolation
├── hurl/
│   ├── billing/                              # Billing Hurl tests (create, update, assign, lifecycle)
│   ├── novu/                                 # Novu notification tests
│   └── paid/                                 # Paid plan tests (gateway interaction)
├── e2e-constants.ts                          # SEED_IDS + E2E_USERS
├── global-setup.ts                           # API readiness check
└── vitest.config.ts
e2e/admin-portal-e2e/                         # Admin portal browser tests (Playwright)
e2e/institute-portal-e2e/                     # Institute portal browser tests (Playwright)
```

## Unit Tests

Unit tests mock external dependencies (repositories, Redis, JWT). No running infrastructure needed.

Key coverage:
- **AuthService**: password hashing, token generation, refresh rotation, reuse detection, logout
- **AbilityFactory**: Redis caching, DB fallback, condition placeholder resolution, role+user rule merging
- **JWT decode**: payload extraction, expiry with configurable buffer
- **Tenant extension**: UUID validation, AsyncLocalStorage context isolation
- **Circuit breaker**: creation, registry, failure thresholds, fallbacks

## E2E Tests

### Docker-based (recommended for CI and clean runs)

Uses `docker/compose.e2e.yaml` to spin up isolated infrastructure + services + test runners. No local setup required beyond Docker.

### Local (for rapid iteration)

Requires `tilt up` for infrastructure. Tilt handles migrations and seeding automatically.

### API Gateway — Vitest

Hits the GraphQL API via shared helpers (`gql-client.ts`, `auth.ts`).

Coverage:
- Login: multi-institute (platformToken + memberships), single-institute (direct accessToken), wrong password, non-existent user
- selectInstitute: manage-all abilities for institute_admin, limited for teacher, condition placeholders resolved for student, rejected without token, rejected for wrong tenant
- `me` query: valid token, missing token, invalid token
- Refresh: token rotation, reused token rejection
- Logout: success, refresh token invalidation after logout
- Audit: full pipeline (mutation → NATS → consumer → DB), GraphQL query API, pagination, RLS isolation, immutability, @NoAudit opt-out
- RLS isolation: cross-tenant notification config isolation, unauthenticated rejection

### API Gateway — Hurl

Sequential HTTP flows testing billing CRUD and subscription lifecycle.

Coverage:
- Plan CRUD: create, update, deactivate
- Plan assignment: free plan (no gateway), paid plan (gateway + checkoutUrl)
- Subscription lifecycle: create → pause → resume, cancel at cycle end, double-cancel rejection, invalid state transitions
- Duplicate subscription rejection
- Novu: API smoke test, login notification flow

### Admin Portal & Institute Portal (Playwright)

Browser tests against admin portal (`http://localhost:4200`) and institute portal (`http://localhost:4300`). Each project has a `playwright.config.ts` using `nxE2EPreset` with a `webServer` command that auto-starts the portal if not already running.

Coverage:
- Login form rendering (title, description, inputs, button)
- Validation errors on empty submission
- Error display for invalid credentials
- Single-institute user (teacher1) login → dashboard redirect
- Multi-institute user (admin) login → institute picker with both institutes
- Multi-institute user selects institute → dashboard redirect

## Adding Tests

**Unit tests:** Create `__tests__/your-file.test.ts` in the relevant project. The project's `vitest.config.ts` picks it up automatically. NX caches results — only re-runs when source files change.

**Project-wide tests:** Add `*.test.ts` files in `tests/`. These run with their own `tests/vitest.config.ts` (not NX-managed). Run via `npx vitest run --config tests/vitest.config.ts`. Use this for cross-cutting validations like doc sync checks that don't belong to any specific lib.

**API e2e (Vitest):** Add `*.e2e.test.ts` files under `e2e/api-gateway-e2e/src/`. Use shared helpers from `src/helpers/`.

**API e2e (Hurl):** Add `.hurl` files under the appropriate subdirectory in `e2e/api-gateway-e2e/hurl/`.

**Portal e2e:** Add `*.spec.ts` files under `e2e/<app>-e2e/src/`. For a new portal e2e project, create `e2e/<name>-e2e/playwright.config.ts` + `project.json` with explicit `e2e` target and `implicitDependencies`.
