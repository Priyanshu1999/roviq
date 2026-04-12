# Testing

## Setup

Tests use Vitest 4 integrated with NX via `@nx/vitest` plugin. Each project with a `vitest.config.ts` automatically gets a `test` target. E2E projects under `e2e/` get an `e2e` target.

## Commands

```bash
# Unit tests (no DB, mocked)
pnpm test:unit                    # vitest: unit-node + unit-dom projects
pnpm test                         # nx run-many -t test (unit + integration, NX-cached)
nx run api-gateway:test           # single project
nx affected -t test               # only changed projects

# Integration tests (real PostgreSQL, roviq_test DB on port 5432)
pnpm test:int                     # vitest --project integration

# E2E tests (requires Docker stack: pnpm e2e:up)
pnpm test:e2e:api                 # Vitest GraphQL tests against api-gateway:3004
pnpm test:e2e:hurl                # Hurl domain workflow tests (Docker --profile hurl)
pnpm test:e2e:ui                  # Playwright UI tests across 3 portals

# Full pipeline
pnpm test:all                     # unit + int + e2e:api + e2e:hurl + e2e:ui

# Coverage
pnpm test:coverage                # unit-node + unit-dom with v8 coverage

# Teardown
pnpm e2e:down                     # remove Docker E2E containers + volumes

# Watch mode (single project)
nx run api-gateway:test --watch
```

**Database per test type:**

| Test type | Database | Port | Connection |
|---|---|---|---|
| Unit | None (mocked) | — | — |
| Integration | `roviq_test` | 5432 | `DATABASE_URL_TEST` in `.env` |
| E2E (all) | `roviq_test` (Docker) | 5433 (host) → 5432 (container) | Docker Compose |
| Dev runtime | `roviq` | 5432 | `DATABASE_URL` in `.env` |

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
| Saraswati Vidya Mandir (NEP + CBSE) | `00000000-0000-4000-a000-000000000101` | — |
| Rajasthan Public School (Traditional + BSEH) | `00000000-0000-4000-a000-000000000102` | — |
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
├── global-setup.ts                           # API readiness check
└── vitest.config.ts
e2e/web-admin-e2e/                            # Admin portal browser tests (Playwright)
e2e/web-institute-e2e/                        # Institute portal browser tests (Playwright)
e2e/web-reseller-e2e/                         # Reseller portal browser tests (Playwright)
e2e/shared/                                   # Shared POM (LoginPage), SEED, E2E_USERS — used by both Vitest E2E and Playwright
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

Browser tests against the unified Next.js web app on port 4200, with hostname-based subdomain routing: `admin.localhost:4200` (platform admin), `reseller.localhost:4200` (reseller), `localhost:4200` (institute). Each project has a `playwright.config.ts` using `nxE2EPreset` with a `webServer` command that auto-starts the app if not already running.

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

## E2E Quick Reference

| What | Value |
|---|---|
| E2E database | `roviq_test` (NOT `roviq`) |
| E2E postgres port (host) | `5433` |
| E2E API gateway port | `3004` |
| Query from host | `psql -h localhost -p 5433 -U roviq -d roviq_test` |
| Query from Docker | `docker exec roviq-e2e-postgres-1 psql -U roviq -d roviq_test` |
| Full reset | `pnpm e2e:down && pnpm e2e:up` |
| Re-seed only | `pnpm e2e:clean` |
| Code changes | `pnpm nx build api-gateway` locally — Docker mounts `dist/`, `libs/`, `apps/api-gateway/src/` so `nx serve` inside Docker picks up changes automatically |
