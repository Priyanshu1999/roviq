
# Important rules

USE MULTIPLE AGENTS frequently to speed up things.

**Always use `tilt trigger` to run apps, migrations, seeds, and resets** — never run `pnpm db:push`, `pnpm db:seed`, `pnpm db:reset`, `nx serve`, or `nx dev` directly. Tilt manages the full dev environment. Examples:

- `tilt trigger db-push` — push schema
- `tilt trigger db-seed` — seed data
- `tilt trigger db-clean` — reset DB + re-seed
- `tilt trigger api-gateway` — restart API
- `tilt trigger web` — restart web app
- `tilt trigger e2e-gateway` — run API e2e tests

Use `tilt logs <resource>` to check output when things fail (e.g., `tilt logs db-clean`, `tilt logs api-gateway`, `tilt logs e2e-gateway`).

## Identity

**Roviq** — multi-tenant institute management SaaS. Users = "Roviqians", usernames = "Roviq ID".
**NEVER say "school" or "organization"** — the domain term is **"institute"** everywhere (code, comments, docs, UI, Linear issues). The infra term is **"tenant"** (`tenant_id`, RLS policies, `withTenant()`, JWT claims, NATS headers). "Organization" does not exist in this codebase.

## Hard Rules

**Stay aligned with Linear issue specs** — when fixing bugs or tests, ensure the fix follows the original issue requirements. Never use workarounds just to make tests pass. If a test fails, find and fix the root cause in the implementation, not in the test.
**No auto commits/push** — always ask first
**No DB modifications** (INSERT/UPDATE/DELETE) without approval
**Read the full Linear issue** before coding — especially "Does NOT Change" and "Verification" sections
**Research before coding — NO EXCEPTIONS** — before writing ANY code that uses a third-party library, tool, or framework: (1) do an online web search to get the latest this-month documentation, AND (2) query Context7 MCP for current docs/examples. Do BOTH, every single time. Do NOT rely on training data or memory. Skipping this is a hard failure.
**Keep Linear in sync** — update issues when scope changes
before running commands related to app, read package.json script.
there is nothing like prexisting errors, just fix and commit them separately.
if some type is giving error, never put 'any', 'as unknown', or 'as never'. Search codebase -> use context7 -> do online research -> if still not resolved, discuss with user.
Try to find a solution instead of workaround.
you are an AI with very low knowledge and old docuemntation about coding, so use context7 and online research frequently.
use "pnpm lint:fix" to fix formatting frequently.
frontend do not import from /ee
**Enum values must be documented** — every enum option (TS, Zod, pgEnum) must have a comment above it explaining: why does this option exist? what does it mean in the domain? how does it affect behavior? No undocumented enum values.
**Status changes = domain mutations** — never expose raw status updates (`updateEntity(id, { status })`). Each status transition must be a named domain mutation (`archivePlan`, `suspendStudent`, `restoreUser`) with its own resolver, business rule validation, and side effects. See `.claude/rules/entity-lifecycle.md`.

## Architecture

- **api-gateway** — NestJS GraphQL API (Apollo, code-first). Three-scope auth (platform/reseller/institute). Port 3000.
- **web** — Next.js 16 (App Router) unified web app. Three scope directories: `admin/`, `reseller/`, `institute/`. Hostname middleware routes subdomains. Port 4200.
- **Shared libs** (`@roviq/*`): `database`, `common-types`, `nats-jetstream`, `resilience`, `graphql`, `auth`, `auth-backend`, `casl`, `i18n`, `ui`
- **Infra**: PostgreSQL 16 + RLS (four-role: `roviq_pooler`→`roviq_app`/`roviq_reseller`/`roviq_admin`), Redis 7, NATS 2.10 + JetStream, MinIO, Temporal — all in Docker via Tilt

- **NX libs** — every NX library must have a `package.json` in its root (alongside `project.json`)

See `docs/architecture.md` for full details.

## Three-Scope Auth Model

Three scopes, each with its own login mutation, scope guard, DB wrapper, and module group:

| Scope | Login mutation | Guard decorator | DB wrapper | Token TTL | Portal URL |
|-------|---------------|-----------------|------------|-----------|------------|
| platform | `adminLogin` | `@PlatformScope()` | `withAdmin()` | 5 min | `admin.roviq.com` |
| reseller | `resellerLogin` | `@ResellerScope()` | `withReseller()` | 10 min | `reseller.roviq.com` |
| institute | `instituteLogin` | `@InstituteScope()` | `withTenant()` | 15 min | `app.roviq.com` (default) |

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

## Key Docs

- `docs/architecture.md` — system architecture
- `docs/auth.md` — authentication (three-scope model, JWT, refresh, impersonation)
- `docs/frontend.md` — frontend patterns
- `docs/infrastructure.md` — infra setup
- `docs/getting-started.md` — onboarding
- `docs/testing.md` — test strategy
- `docs/plans/` — design docs and implementation plans


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

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
