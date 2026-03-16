## Identity

**Roviq** — multi-tenant institute management SaaS. Users = "Roviqians", usernames = "Roviq ID".
**NEVER say "school" or "organization"** — the domain term is **"institute"** everywhere (code, comments, docs, UI, Linear issues). The infra term is **"tenant"** (`tenant_id`, RLS policies, `withTenant()`, JWT claims, NATS headers). "Organization" does not exist in this codebase.

## Hard Rules

**No auto commits/push** — always ask first
**No DB modifications** (INSERT/UPDATE/DELETE) without approval
**Read the full Linear issue** before coding — especially "Does NOT Change" and "Verification" sections
**Research before coding — NO EXCEPTIONS** — before writing ANY code that uses a third-party library, tool, or framework: (1) do an online web search to get the latest this-month documentation, AND (2) query Context7 MCP for current docs/examples. Do BOTH, every single time. Do NOT rely on training data or memory. Skipping this is a hard failure.
**Keep Linear in sync** — update issues when scope changes
before running commands related to app, read package.json script.
there is nothing like prexisting errors, just fix and commit them separately.
if some type is giving error, never put 'any' or 'as unknown'. Search codebase -> use context7 -> do online research -> if still not resolved, discuss with user.
Try to find a solution instead of workaround.
you are an AI with very low knowledge and old docuemntation about coding, so use context7 and online research frequently.
use "pnpm lint:fix" to fix formatting frequently.
frontend do not import from /ee

## Architecture

- **api-gateway** — NestJS GraphQL API (Apollo, code-first). Auth (JWT + Passport), CASL authorization. Port 3000.
- **admin-portal** — Next.js 16 (App Router) for platform-wide admin.
- **institute-portal** — Next.js 16 (App Router) for institute users.
- **Shared libs** (`@roviq/*`): `database`, `common-types`, `nats-utils`, `graphql`, `auth`, `i18n`, `ui`
- **Infra**: PostgreSQL 16 + RLS, Redis 7, NATS 2.10 + JetStream, MinIO, Temporal — all in Docker via Tilt

- **NX libs** — every NX library must have a `package.json` in its root (alongside `project.json`)

See `docs/architecture.md` for full details.

## Key Docs

- `docs/architecture.md` — system architecture
- `docs/auth.md` — authentication
- `docs/frontend.md` — frontend patterns
- `docs/infrastructure.md` — infra setup
- `docs/getting-started.md` — onboarding
- `docs/testing.md` — test strategy
- `docs/plans/` — design docs and implementation plans
