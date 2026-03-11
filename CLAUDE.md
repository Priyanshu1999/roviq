# CLAUDE.md

Detailed rules are in `.claude/rules/` — they load automatically (some are path-scoped).

## Identity

**Roviq** — multi-tenant institute management SaaS. Users = "Roviqians", usernames = "Roviq ID".
**NEVER say "school"** — always "institute" in code, comments, docs, UI, Linear issues.

## Hard Rules

1. **No auto commits/push** — always ask first
2. **No DB modifications** (INSERT/UPDATE/DELETE) without approval
3. **Read the full Linear issue** before coding — especially "Does NOT Change" and "Verification" sections
4. **Research before coding — NO EXCEPTIONS** — before writing ANY code that uses a third-party library, tool, or framework: (1) do an online web search to get the latest this-month documentation, AND (2) query Context7 MCP for current docs/examples. Do BOTH, every single time. Do NOT rely on training data or memory. Skipping this is a hard failure.
5. **Keep Linear in sync** — update issues when scope changes

## Commands

```bash
# Dev environment (Tilt orchestrates infra via Docker + apps locally)
tilt up                      # Start everything
tilt down                    # Stop everything

# Database
pnpm run db:migrate:dev       # Interactive dev migrations
pnpm run db:migrate           # Deploy migrations (CI/production)
pnpm run db:generate          # Regenerate Prisma client
pnpm run db:seed              # Seed test data
pnpm run db:reset             # Nuke DB + re-migrate (fresh start)
```

## Architecture

- **api-gateway** — NestJS GraphQL API (Apollo, code-first). Auth (JWT + Passport), CASL authorization. Port 3000.
- **admin-portal** — Next.js 16 (App Router) for platform-wide admin.
- **institute-portal** — Next.js 16 (App Router) for institute users.
- **Shared libs** (`@roviq/*`): `prisma-client`, `common-types`, `nats-utils`, `graphql`, `auth`, `i18n`, `ui`
- **Infra**: PostgreSQL 16 + RLS, Redis 7, NATS 2.10 + JetStream, MinIO, Temporal — all in Docker via Tilt

See `docs/architecture.md` for full details.

## Key Docs

- `docs/architecture.md` — system architecture
- `docs/auth.md` — authentication
- `docs/frontend.md` — frontend patterns
- `docs/infrastructure.md` — infra setup
- `docs/getting-started.md` — onboarding
- `docs/testing.md` — test strategy
- `docs/plans/` — design docs and implementation plans
