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

# Integration tests (real PostgreSQL, roviq_test DB on port 5434)
pnpm test:int                     # vitest --project integration

# E2E tests (requires Docker stack: pnpm e2e:up)
pnpm test:e2e:api                 # Vitest GraphQL tests against api-gateway:3004
pnpm test:e2e:ui                  # Playwright UI tests across 3 portals

# Full pipeline
pnpm test:all                     # unit + int + e2e:api + e2e:ui

# Coverage
pnpm test:coverage                # unit-node + unit-dom with v8 coverage

# Teardown
pnpm e2e:down                     # remove Docker E2E containers + volumes

# Watch mode (single project)
nx run api-gateway:test --watch
```

## Docker Compose Files

Compose files live under `docker/` and are selected explicitly per use case — this project does not use named `--profile` flags.

| File | What it starts | When to use |
|---|---|---|
| `compose.infra.yaml` | Postgres, Redis, NATS (infra only) | Local dev infrastructure — apps run via Tilt |
| `compose.dev.yaml` | Full dev stack (infra + apps, port 3000) | Running the stack in Docker instead of Tilt |
| `compose.e2e.yaml` | Migrated+seeded `roviq_test` stack on port 3004 (host 5435 for PG) | `pnpm test:e2e:api`, `pnpm test:e2e:ui`, CI `e2e-api`/`e2e-ui` jobs |
| `compose.app.yaml` | Application-only bundle (no infra) | Compose-in-compose reuse |
| `compose.novu.yaml` | Novu notification stack | Notification smoke tests |

Convenience scripts:

```bash
pnpm infra:up       # docker compose -f docker/compose.infra.yaml up -d
pnpm e2e:up         # docker compose -p roviq-e2e -f docker/compose.e2e.yaml up -d --build --wait
pnpm e2e:clean      # re-run migrate+seed on existing e2e stack
pnpm e2e:down       # tear down e2e stack + volumes
```

**Database per test type:**

| Test type | Database | Port | Connection |
|---|---|---|---|
| Unit | None (mocked) | — | — |
| Integration | `roviq_test` | 5434 | `DATABASE_URL_TEST` in `.env` |
| E2E (all) | `roviq_test` (Docker) | 5435 (host) → 5432 (container) | Docker Compose |
| Dev runtime | `roviq` | 5434 | `DATABASE_URL` in `.env` |

## E2E Architecture

```
docker/compose.e2e.yaml
├── postgres (clean roviq_test DB via init-db.sh)
├── nats
├── redis
├── migrate-and-seed (runs drizzle-kit migrate + seed.ts, exits)
├── api-gateway (waits for migrate-and-seed)
├── notification-service (waits for migrate-and-seed)
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
| GraphQL queries/mutations | Vitest + fetch | `e2e/api-gateway-e2e/src/` | Auth flows, audit, RLS isolation |
| HTTP flow (billing lifecycle) | Vitest | `e2e/api-gateway-e2e/src/` | Billing CRUD, subscription lifecycle |
| RLS isolation | Vitest | `e2e/api-gateway-e2e/src/` | Cross-tenant data leakage prevention |
| Audit trail | Vitest | `e2e/api-gateway-e2e/src/` | Mutation → NATS → audit log entry |
| Novu notifications | Vitest | `e2e/api-gateway-e2e/src/` | Novu API smoke, login notification flow |
| Paid billing | Vitest | `e2e/api-gateway-e2e/src/` | Paid plan assignment, gateway interaction |
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
├── global-setup.ts                           # API readiness check
└── vitest.config.ts
e2e/playwright.config.ts                      # Unified Playwright config (all 3 portals + cross-portal)
e2e/web-admin-e2e/src/                        # Admin portal specs + auth setup
e2e/web-institute-e2e/src/                    # Institute portal specs + auth setup
e2e/web-reseller-e2e/src/                     # Reseller portal specs + auth setup
e2e/cross-portal/src/                         # Cross-portal tests (multi-context, all auth states)
e2e/shared/                                   # Shared POM (LoginPage), SEED, E2E_USERS, preflight, console-guardian
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

#### Typed GraphQL operations

Operations live in `e2e/api-gateway-e2e/src/operations/*.graphql` (op names prefixed `E2e*` to avoid clashes with `apps/web` ops). `pnpm codegen` emits `TypedDocumentNode` constants in `src/__generated__/graphql.ts`. Specs import the `*Document` constants and pass them to `gql()` — variables and `data` shape are inferred, no manual generic. Drift is gated by `pnpm check:codegen-drift` (CI fails if `pnpm codegen` would change committed files).

Coverage:

- Login: multi-institute (platformToken + memberships), single-institute (direct accessToken), wrong password, non-existent user
- selectInstitute: manage-all abilities for institute_admin, limited for teacher, condition placeholders resolved for student, rejected without token, rejected for wrong tenant
- `me` query: valid token, missing token, invalid token
- Refresh: token rotation, reused token rejection (rotation-reason cascade only — see `docs/auth.md` "Token Refresh")
- Logout: success, refresh token invalidation after logout
- Audit: full pipeline (mutation → NATS → consumer → DB), GraphQL query API, pagination, RLS isolation, immutability, @NoAudit opt-out
- RLS isolation: cross-tenant notification config isolation, unauthenticated rejection
- Notifications: the `notifications.api-e2e.spec.ts` suite auto-skips at test collection when Novu is unreachable. `probeNovuReachableSync` (in `e2e/api-gateway-e2e/src/helpers/novu.ts`) runs a synchronous TCP probe against `NOVU_API_URL` with a ~3s timeout at module load; on failure the suite is skipped with a specific reason in the Vitest output rather than letting each test time out at 30s. To force-skip locally during unrelated e2e runs, point `NOVU_API_URL` at any closed port (e.g. `NOVU_API_URL=http://localhost:59999`).

### Password policy

`NEW_PASSWORD_MIN_LENGTH` (in `libs/shared/common-types/src/lib/policy/password-policy.ts`) is the single source for the minimum-length policy enforced by `changePassword` on the server, the `@roviq/common-types` Zod schema on the client, and the e2e fixtures. Update that constant — not duplicates — when the policy changes.

### Playwright UI Tests (all portals)

A single `e2e/playwright.config.ts` drives all 3 portals plus cross-portal tests. One `globalSetup` runs `pnpm e2e:up` (idempotent), one `webServer` starts Next.js on port 4201 (separate from dev port 4200). Subdomain routing: `admin.localhost:4201` (platform), `reseller.localhost:4201` (reseller), `localhost:4201` (institute).

**Project groups** (Playwright `--project` filter):

| Group | Portal | Auth | What it tests |
|---|---|---|---|
| `admin-setup` | admin | — | Produces `admin.json` storageState |
| `institute-setup` | institute | — | Produces `institute.json` storageState |
| `reseller-setup` | reseller | — | Produces `reseller.json` storageState |
| `admin-login` | admin | none | Login form, validation, redirect |
| `institute-login` | institute | none | Login form, institute picker |
| `admin` | admin | admin | Dashboard, institutes, audit logs, navigation |
| `institute` | institute | institute | Students, staff, guardians, academics, groups, settings |
| `reseller` | reseller | reseller | Billing, plans, subscriptions |
| `cross-portal` | all | all 3 | Multi-portal flows (e.g., institute visible to both admin and reseller) |

**Running subsets:**

```bash
pnpm test:e2e:ui                              # all portals + cross-portal
pnpm test:e2e:ui -- --project=admin*          # admin setup + login + authenticated
pnpm test:e2e:ui -- --project=institute*      # institute only
pnpm test:e2e:ui -- --project=cross-portal    # cross-portal only
pnpm test:e2e:ui -- --project=admin -g "dashboard"  # single test by grep
```

### Cross-Portal Tests

Tests in `e2e/cross-portal/src/` verify flows that span multiple portals. They depend on all 3 auth setup projects and use `browser.newContext({ storageState })` to switch between authenticated portal sessions within a single test.

Example: admin sees an institute → reseller portal also lists it.

Pattern:
1. Create context with admin storageState → navigate admin portal → assert
2. Close admin context
3. Create context with reseller storageState → navigate reseller portal → assert
4. Close reseller context

## Quality Guardrails

Beyond correctness, the test suite enforces a few cross-cutting quality properties.

### Accessibility (axe-core)

Every Playwright test runs a WCAG 2.0/2.1 A+AA scan via `@axe-core/playwright` on its final page state. The scan is configured in `e2e/shared/console-guardian.ts` and is on by default (`checkAccessibility: true`).

- **Only `critical` impact fails the test** — missing form labels, non-keyboard-reachable controls, zero-contrast text. These are real barriers.
- **Serious / moderate / minor violations** (color contrast variance, landmark nesting, etc.) are surfaced as `a11y-non-critical` test annotations in the HTML report so they can be triaged over time without blocking CI.
- Known third-party noise is excluded: `[data-novu-inbox]`, `[data-sonner-toaster]`, and the Radix UI rules `scrollable-region-focusable`, `aria-hidden-focus`, `document-title`.
- Opt out per-test when needed: `test.use({ checkAccessibility: false })` — used by visual-regression specs where a11y is already covered elsewhere.
- The fixture also reports missing i18n keys, unexpected console errors, and GraphQL responses that contain an `errors` array.

### Visual regression (Playwright screenshots)

Per-portal `visual-regression.e2e.spec.ts` files snapshot the login page, dashboard, and a representative data table. `toHaveScreenshot()` compares against PNG baselines committed to `e2e/web-*-e2e/src/visual-regression.e2e.spec.ts-snapshots/`.

- 1% diff tolerance (`maxDiffPixelRatio: 0.01`) absorbs font-rendering and antialiasing drift.
- Update baselines after intentional UI changes: `pnpm test:e2e:ui -- --update-snapshots` (needs `pnpm e2e:up` first). Commit the regenerated PNGs in the same PR as the UI change.
- First-run behavior: Playwright auto-creates baselines when none exist. The first CI run after adding a new screenshot test passes; subsequent runs compare.

### CI guardrail scripts

Lightweight grep-based checks that catch degradation in test hygiene:

| Script | Enforces | Wired into CI |
|---|---|---|
| `scripts/ci-check-integration-mocks.sh` | `*.integration.spec.ts` files cannot mock the database (Drizzle/Database/Pool). If a file needs a DB mock, it should be renamed to `*.spec.ts` (unit). | Yes — via `pnpm test:check-integration` |
| `scripts/ci-check-skips.sh` | Every static `.skip()`/`.todo()` must include a `ROV-xxx` Linear reference. Runtime conditional skips (`test.skip(condition, 'reason')`) are allowed. | **Deferred** — script exists but not wired pending orphaned-skip cleanup (tracked in ROV-233) |

Both scripts are pure grep — fast enough to run in the `lint` job without extra install steps.

## Adding Tests

**Unit tests:** Create `__tests__/your-file.test.ts` in the relevant project. The project's `vitest.config.ts` picks it up automatically. NX caches results — only re-runs when source files change.

**Project-wide tests:** Add `*.test.ts` files in `tests/`. These run with their own `tests/vitest.config.ts` (not NX-managed). Run via `npx vitest run --config tests/vitest.config.ts`. Use this for cross-cutting validations like doc sync checks that don't belong to any specific lib.

**API e2e (Vitest):** Add `*.e2e.test.ts` files under `e2e/api-gateway-e2e/src/`. Use shared helpers from `src/helpers/`.

**Portal e2e:** Add `*.e2e.spec.ts` files under `e2e/web-<scope>-e2e/src/`. The unified `e2e/playwright.config.ts` picks them up automatically — no per-project config needed.

**Cross-portal e2e:** Add `*.e2e.spec.ts` files under `e2e/cross-portal/src/`. Use `browser.newContext({ storageState })` with the pre-built auth files to switch portals within a test.

## E2E Quick Reference

| What | Value |
|---|---|
| E2E database | `roviq_test` (NOT `roviq`) |
| E2E postgres port (host) | `5435` |
| E2E API gateway port | `3004` |
| Query from host | `psql -h localhost -p 5435 -U roviq -d roviq_test` |
| Query from Docker | `docker exec roviq-e2e-postgres-1 psql -U roviq -d roviq_test` |
| Full reset | `pnpm e2e:down && pnpm e2e:up` |
| Re-seed only | `pnpm e2e:clean` |
| Code changes | `pnpm nx build api-gateway` locally — Docker mounts `dist/`, `libs/`, `apps/api-gateway/src/` so `nx serve` inside Docker picks up changes automatically |
