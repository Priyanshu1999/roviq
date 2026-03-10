# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.
Detailed rules are in `.claude/rules/` — they load automatically (some are path-scoped).

## Identity

**Roviq** — multi-tenant institute management SaaS. Users = "Roviqians", usernames = "Roviq ID".
**NEVER say "school"** — always "institute" in code, comments, docs, UI, Linear issues.

## Hard Rules

1. **No auto commits/push** — always ask first
2. **No DB modifications** (INSERT/UPDATE/DELETE) without approval
3. **pnpm** for everything — never npm/bun/yarn
4. **Biome** only — no ESLint, no Prettier, single `biome.json` at root
5. **Read the full Linear issue** before coding — especially "Does NOT Change" and "Verification" sections
6. **Pre-commit/PR gate** — before ANY commit or PR, run ALL of these (non-negotiable):
   - `pnpm run lint` — zero errors
   - `pnpm run typecheck` — zero errors
   - `pnpm run test` — all unit tests pass
   - `pnpm run e2e` — all e2e tests pass
7. **Research before coding — NO EXCEPTIONS** — before writing ANY code that uses a third-party library, tool, or framework: (1) do an online web search to get the latest this-month documentation, AND (2) query Context7 MCP for current docs/examples. Do BOTH, every single time. Do NOT rely on training data or memory. Skipping this is a hard failure.
8. **Keep Linear in sync** — update issues when scope changes

## Commands

```bash
# Dev environment (Tilt orchestrates infra via Docker + apps locally)
tilt up                      # Start everything (infra in Docker, apps locally)
tilt down                    # Stop everything

# Individual apps (if not using Tilt)
pnpm run dev:gateway          # API Gateway — port 3000
pnpm run dev:admin            # Admin Portal — port 4200
pnpm run dev:portal           # Institute Portal — port 4300

# Database
pnpm run db:migrate:dev       # Interactive dev migrations
pnpm run db:migrate           # Deploy migrations (CI/production)
pnpm run db:generate          # Regenerate Prisma client
pnpm run db:seed              # Seed test data
pnpm run db:reset             # Nuke DB + re-migrate (fresh start)

# Build, lint, test
pnpm run build                # nx run-many -t build
pnpm run test                 # nx run-many -t test
pnpm run lint                 # biome check .
pnpm run lint:fix             # biome check --write .
pnpm run format               # biome format --write .
pnpm run typecheck            # tsc -b tsconfig.json
pnpm run e2e                  # E2E tests
nx affected:test             # Test changed projects only
nx affected:build            # Build changed projects only
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

## Tech Stack

NX monorepo, NestJS, GraphQL (code-first, graphql-ws), PostgreSQL 16 + RLS, Prisma, CASL, NATS JetStream, Redis, MinIO, Temporal, Next.js (App Router), Tailwind CSS v4, shadcn/ui, Apollo Client, react-hook-form + Zod, TanStack Table, nuqs, next-intl, date-fns, Novu, Sentry, OpenTelemetry + Grafana, GitHub Actions, Vitest.

## Git

- Conventional commits: `feat(auth): implement refresh rotation`
- Never amend — new commits only
- No AI attribution — never add `Co-Authored-By: Claude` or similar
