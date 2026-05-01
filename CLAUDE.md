# Important rules - It will be a very shameful act by you if you don't follow each and every rule declared here

**Always use `tilt trigger` to run apps, migrations, seeds, and resets** — never run `pnpm db:push`, `pnpm db:seed`, `pnpm db:reset`, `nx serve`, or `nx dev` directly. Tilt manages the full dev environment. Examples:

- `tilt trigger db-push` — push schema
- `tilt trigger db-seed` — seed data
- `tilt trigger db-clean` — reset DB + re-seed
- `tilt trigger api-gateway` — restart API
- `tilt trigger web` — restart web app
- `tilt trigger e2e-gateway` — run API e2e tests
- `tilt trigger e2e-ui` — run Playwright UI tests across all 3 e2e projects (web-admin-e2e, web-institute-e2e, web-reseller-e2e)
- `pnpm e2e:up` — start Docker e2e infra (run once, stays running), MUST run it before e2e testing. if already running, just re-seed and continue.
- `pnpm test:e2e:api` — Vitest E2E API tests against running api-gateway. Routes through cacheable Nx target `api-gateway-e2e:test-e2e`. **All new E2E API tests go here.**
- `pnpm test:e2e:ui` — Playwright UI tests across the 3 canonical e2e projects (web-admin-e2e, web-institute-e2e, web-reseller-e2e) plus cross-portal. Routes through cacheable Nx target `web-e2e-suite:e2e` (single invocation, single cache hash).
- `pnpm test:all` — full test pipeline: unit + integration + e2e:api + e2e:ui
- `pnpm ci:check` — unified gate. Runs lint/typecheck/unit/integration/e2e in parallel; locally uses `nx affected` against `origin/main`, on CI runs the full suite. Invoked by `.husky/pre-push`. Bypass: `SKIP_PREPUSH=1 git push` or `git push --no-verify`.

CI runs **six blocking jobs**: `lint`, `typecheck`, `test` (unit — no DB), `build`, `e2e-api` (Docker stack + Vitest E2E), `e2e-ui` (Docker stack + Playwright). Integration tests (`pnpm test:int`) run as part of the `test` job against `roviq_test` via `DATABASE_URL_TEST`. E2E jobs spin up `compose.e2e.yaml` with `--wait` and tear it down via `if: always()`.

Tilt auto-detects file changes for app resources (api-gateway, web) — no `tilt trigger` needed after editing code, just check logs. Use `tilt trigger` only for manual tasks (db-push, db-seed, db-clean, e2e-gateway). After triggering or a file change, wait max **15 seconds** then check `tilt logs`.

Tilt `codegen` resource runs `pnpm codegen --watch` automatically — regenerates GraphQL types when schema or document files change. After adding/modifying GraphQL resolvers or frontend queries, check `tilt logs codegen` to confirm types regenerated.

Use `tilt logs <resource>` to check output when things fail (e.g., `tilt logs db-clean`, `tilt logs api-gateway`, `tilt logs e2e-gateway`).

## Identity

**Roviq** — multi-tenant institute management SaaS. Users = "Roviqians", usernames = "Roviq ID".
**NEVER say "school" or "organization"** — the domain term is **"institute"** everywhere (code, comments, docs, UI, Linear issues). The infra term is **"tenant"** (`tenant_id`, RLS policies, `withTenant()`, JWT claims, NATS headers).

## Hard Rules

If any of below rule applies to you then you `MUST` read full details: `sed -n '/\[TAGID\]/,/^---$/p' docs/references/hard-rules-reference.md`

- [NWKRD] **No workarounds — proper fixes only.** Root-cause bugs, don't patch symptoms. +5 proper, -5 hack
- [NACPR] **No auto commits/push.** Output `git add` + `git commit` for copy-paste. Conventional commits, header ≤100 chars
- [NDBMD] **No DB modifications** (INSERT/UPDATE/DELETE) without approval
- [LNFST] **Linear first** — read the full issue (especially "Does NOT Change" + "Verification") before coding. Keep in sync
- [RSBFC] Instead of try-catch on errors: (1) web search latest docs + (2) Context7 MCP. Do BOTH every time
- [NTESC] **No type escape hatches** — never `any`, `as unknown`, `as never`. Search codebase → context7 → web → discuss with user
- [BFCMT] **Before commit** — Playwright-verify every touched code path, write/update tests, run `pnpm lint:fix`
- [PXERR] Found pre-existing issue? Fix it right now. It's bigger? Discuss user to create a linear issue using skill. — fix and commit them separately
- [RDPKG] Read `package.json` scripts before running app commands. Run `pnpm lint:fix` frequently
- [NPENV] `process.env['FOO']` banned (Biome); `process.env.FOO` banned until `FOO` is on `ProcessEnv` (TS)
- [NFEEI] Frontend must not import from `/ee`
- [SESPR] **Session persistence** — create `.claude/sessions/<session-uuid>/` with 5 files at session start. Update after every commit/agent/direction change
- [SHCMT] **Comments: short and useful, WHY-only** (hidden constraint, non-obvious workaround). Skip if a reader can infer from code + name. No long block comments or docstrings restating what the code does

## Architecture

- **api-gateway** — NestJS GraphQL API (Apollo, code-first). Three-scope auth (platform/reseller/institute). Port 3005.
- **web** — Next.js 16 (App Router) unified web app. Three scope directories: `admin/`, `reseller/`, `institute/`. Hostname middleware routes subdomains. Port 4200.
- **Shared libs** (`@roviq/*`): `database`, `common-types`, `nats-jetstream`, `resilience`, `graphql`, `auth`, `auth-backend`, `casl`, `i18n`, `ui`
- **Infra**: PostgreSQL 18 + RLS (four-role: `roviq_pooler`→`roviq_app`/`roviq_reseller`/`roviq_admin`), Redis 7, NATS 2.10 + JetStream, MinIO, Temporal — all in Docker via Tilt

- **NX libs** — every NX library must have a `package.json` in its root (alongside `project.json`)

See `docs/architecture.md` for full details.

## Three-Scope Auth Model

Three scopes, each with its own login mutation, scope guard, DB wrapper, and module group:

| Scope     | Login mutation   | Guard decorator     | DB wrapper       | TTL    | Portal URL           | Local URL                 |
| --------- | ---------------- | ------------------- | ---------------- | ------ | -------------------- | ------------------------- |
| platform  | `adminLogin`     | `@PlatformScope()`  | `withAdmin()`    | 5 min  | `admin.roviq.com`    | `admin.localhost:4200`    |
| reseller  | `resellerLogin`  | `@ResellerScope()`  | `withReseller()` | 10 min | `reseller.roviq.com` | `reseller.localhost:4200` |
| institute | `instituteLogin` | `@InstituteScope()` | `withTenant()`   | 15 min | `app.roviq.com`      | `localhost:4200`          |

All tokens are `type: 'access'` with `scope` field. No more `isPlatformAdmin` or `type: 'platform'`.

- **Guards/decorators** live in `@roviq/auth-backend` (`libs/backend/auth/`)
- **Scope guards** use `createScopeGuard(scope)` factory
- **CASL** lives in `@roviq/casl` (`libs/backend/casl/`) — authorization only, not authentication
- **DB roles**: `roviq_pooler` (NOINHERIT LOGIN) → assumes `roviq_app`/`roviq_reseller`/`roviq_admin` via `SET LOCAL ROLE`
- **DATABASE_URL** uses `roviq_pooler`, **DATABASE_URL_MIGRATE** uses `roviq` (superuser)

## API Gateway Structure

```
apps/api-gateway/src/
  auth/              — JWT strategy, auth service, auth events, impersonation, repositories, ws-ticket
  admin/             — platform-scope module group (@PlatformScope resolvers)
  reseller/          — reseller-scope module group (@ResellerScope resolvers)
  institute/         — institute-scope module group (@InstituteScope resolvers)
    management/      — institute CRUD (create, update, activate, suspend, delete)
    section/         — class sections
    standard/        — grade levels
    subject/         — subjects & curriculum
  casl/              — CASL ability guard + module
  audit/             — audit logging
  common/            — pagination, middleware, decorators
```

## Web App Structure

```
apps/web/src/app/[locale]/
  admin/             — platform admin pages (audit-logs, billing, observability)
  reseller/          — reseller pages (placeholder)
  institute/         — institute pages (dashboard, select-institute, settings)
middleware.ts        — hostname → scope rewrite (admin.* → /admin/, default → /institute/)
```

## Workflow

### Runtime Verification

Compilation passing does NOT mean it works. After any change to NX project.json, tsconfig, path aliases, Docker compose, infra configs, env vars, or new library scaffolding — **you MUST run the actual app** (`tilt trigger api-gateway` and check `tilt logs api-gateway`) and verify it starts without runtime errors. Fix iteratively until clean.

### Phase Completion — Bug-Free Gate

After completing each phase/issue, before declaring done:

1. **Run tests**: `pnpm test` — fix any failures iteratively until all pass
2. **Run lint**: `pnpm lint:fix` — fix any errors
3. **Run typecheck**: `pnpm exec tsc --noEmit` if touching TypeScript
4. **Write/update tests**: Every new code path must have tests before moving on
5. **Write/update docs**: Update relevant docs in the same batch
6. **Re-read the original Linear issue + comments**: Cross-check every spec item against your implementation. Confirm no deviation or missed requirement
7. **RLS audit**: When changing models, verify and report RLS status for every affected table
8. **Fix iteratively**: If anything fails, fix and re-run until clean. Do NOT move to the next phase with known failures

### Deviations & Deferred Work

- **Deviations** — spec drifts, trade-offs, user-rejected approaches: add as a comment on the current Linear issue
- **Deferred work** — if the user asks to defer something, create a new Linear issue with proper labels and set the current issue as parent. Nothing is silently deferred

## i18n Fields

1. **DB stores full JSONB, API returns full JSONB, frontend resolves locale** — `i18nText('name')` stores `{ "en": "Science", "hi": "विज्ञान" }`. GraphQL returns the whole object (NOT a resolved string). Frontend uses `useI18nField()` hook to pick the right locale with fallback chain: current → `en` → first available. NEVER resolve locale in resolvers or services.
2. **Only human-readable, tenant-authored text gets `i18nText()`** — Institute names, section names, role names, plan names. NEVER for: emails, usernames, phone numbers, UDISE codes, UUIDs, enum values, or any language-independent field.
3. **Zod validates `en` key exists** — Use `i18nTextSchema` from `@roviq/i18n`. English is required, other locales optional. Forms use `<I18nInput>` component showing one field per locale from the tenant's `supportedLocales` config.

## Quick Mistake Reference

Entries covered by skills (`/drizzle-database`, `/backend-service`) are not repeated here.

| Don't                                                      | Do                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectInstitute(tenantId)`                                | `selectInstitute(membershipId)`                                                                                                                               |
| `User.abilities`                                           | `Membership.abilities` (abilities live on Membership)                                                                                                         |
| `$transaction`                                             | `withTenant(db, tenantId, fn)` — `tenantTransaction()` does not exist                                                                                         |
| `if (role === 'teacher')`                                  | `ability.can()`                                                                                                                                               |
| `GqlAuthGuard` from `@roviq/casl`                          | `GqlAuthGuard` from `@roviq/auth-backend`                                                                                                                     |
| `APP_GUARD` for scope isolation                            | `@PlatformScope()` / `@ResellerScope()` / `@InstituteScope()` at class level                                                                                  |
| Raw `<button>`                                             | `<Button>` from `@roviq/ui`                                                                                                                                   |
| Inline `<Popover>` + lucide `HelpCircle` next to a label   | `<FieldInfoPopover>` from `@roviq/ui`; on shared field components pass `info={<FieldInfoPopover …/>}`. Copy lives under `fieldHelp.*` in the locale JSON      |
| Hardcoded UI strings                                       | `useTranslations()` from `next-intl`                                                                                                                          |
| `new Date().toLocaleDateString()`                          | `useFormatDate()` from `@roviq/i18n`                                                                                                                          |
| Nav href `/dashboard`                                      | Include scope prefix: `/admin/dashboard`, `/institute/dashboard`                                                                                              |
| Writing docs/assertions from memory                        | Verify against actual source code before writing                                                                                                              |
| New `@roviq/*` lib without vitest alias                    | Add to `apps/api-gateway/vitest.config.ts` `resolve.alias` too                                                                                                |
| Hardcoded Redis key prefixes                               | Use `REDIS_KEYS` constants from `auth/redis-keys.ts`                                                                                                          |
| Impersonation token refresh                                | Impersonation tokens are non-renewable. No refresh token created                                                                                              |
| `defaultRandom()` or `gen_random_uuid()`                   | `.default(sql`uuidv7()`)` (PG 18 native)                                                                                                                      |
| E2E locators: `getByRole`, `getByText`, `getByPlaceholder` | `page.getByTestId('…')` — Playwright's default `data-testid` attribute (NOT `data-test-id`). Add `data-testid="foo"` on the target element in production code |
| Re-running tests/builds to see different output            | Save to temp file first: `pnpm test > /tmp/out.txt 2>&1`, then `grep`/`tail` from file                                                                        |
| Querying e2e DB as `roviq` default                         | E2E uses `roviq_test` DB: `psql -U roviq -d roviq_test`                                                                                                       |
| `tx.select().from(subjects)` for reads (and other soft-deletable tables) | `tx.select().from(subjectsLive)` — every soft-deletable table has a `<table>Live` security_invoker view that hides trashed rows. Writes still target the base table (`tx.insert(subjects)…`). CI guard: `pnpm check:live-views`. `withTrash()` removed |
| `@Inject('JETSTREAM_CLIENT') natsClient` + `natsClient.emit(...).subscribe(...)` in services | Inject `EventBusService` and call `eventBus.emit('PREFIX.action', payload)` — wraps NATS JetStream + GraphQL pubsub. Every prefix MUST have a stream in `libs/backend/nats-jetstream/src/streams/stream.config.ts` (CI checks via `nats-jetstream:test`) |
| `if (!user.resellerId) throw new ForbiddenException(...)` inline in resolvers | `assertResellerContext(user)` / `assertTenantContext(user)` from `@roviq/auth-backend` — narrows the type and centralises the error shape |
| Local `diffDays` / `assertValidRange` per service | `calendarDaysBetween` / `isValidDateRange` / `rangesOverlap` from `@roviq/common-types/date-range` |

## Skills (when needed, not always loaded)

Domain-specific rules live in `.claude/skills/` and load only when relevant:

- `/frontend-ux` — UX patterns, accessibility, i18n, responsive, Indian user context
- `/testing-unit` — Vitest unit tests, mocking, factories, shared conventions
- `/testing-integration` — NestJS integration tests with real PostgreSQL + RLS
- `/testing-e2e` — E2E API tests (Vitest only), subscriptions, webhooks
- `/testing-frontend` — Component tests (RTL) + Playwright UI tests across 3 portals
- `/drizzle-database` — Drizzle v1 beta, schema patterns, RLS, migrations
- `/backend-service` — Service layer rules, scope→DB mapping, status mutations, event naming, ownership boundaries

## Key Docs

- `docs/architecture.md` — system architecture
- `docs/auth.md` — authentication (three-scope model, JWT, refresh, impersonation)
- `docs/frontend.md` — frontend patterns
- `docs/infrastructure.md` — infra setup
- `docs/getting-started.md` — onboarding
- `docs/testing.md` — test strategy
- `docs/dependency-updates.md` — supply-chain-safe dependency updates with 24h/7d release-age gates; minors auto-batch via `pnpm deps:update`, majors migrate one-at-a-time through Claude Code via `pnpm deps:upgrade`
- `docs/plans/` — design docs and implementation plans
- `docs/changelogs/testing-troubleshooting.md` — **append-only** log of testing-infra issues (slow pre-push, Docker rebuilds, flaky suites, Nx cache misses) and their fixes. After fixing ANY testing-related issue, append a new entry — never edit or delete existing entries. If a fix resolves a prior `diagnosed` entry, append a new `fixed` entry that references the diagnosis date.

## Docker Compose Files

Select the right compose file explicitly — this repo does not use `--profile` flags.

| File                        | Purpose                                                               | Common entry point                                       |
| --------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `docker/compose.infra.yaml` | Postgres, Redis, NATS (infra only)                                    | `pnpm infra:up` (Tilt runs apps)                         |
| `docker/compose.dev.yaml`   | Full dev stack inside Docker                                          | `pnpm dev:docker`                                        |
| `docker/compose.e2e.yaml`   | Migrated+seeded `roviq_test` stack (PG host port 5435, API port 3004) | `pnpm e2e:up` → `pnpm test:e2e:api` / `pnpm test:e2e:ui` |
| `docker/compose.app.yaml`   | App-only bundle (no infra)                                            | Reused by other composes                                 |
| `docker/compose.novu.yaml`  | Novu notification stack                                               | `pnpm novu:setup`                                        |

See `docs/testing.md` for the full workflow.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
