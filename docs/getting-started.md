# Getting Started

## Prerequisites

- Node.js 20+
- Bun (package manager)
- Docker Desktop
- [Tilt](https://docs.tilt.dev/install.html) (dev environment orchestrator)

## Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd roviq
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env if needed (defaults work for local Docker infra)

# 3. Start everything with Tilt
tilt up

# 4. Run database migrations (in a separate terminal)
bun run db:migrate:dev

# 5. Seed test data
bun run db:seed
```

Tilt starts infra (Postgres, Redis, NATS, MinIO, Temporal) in Docker and apps locally. Open the Tilt UI at http://localhost:10350 to monitor all resources.

## Test Credentials

| Username | Password | Role | Orgs |
|----------|----------|------|------|
| admin | admin123 | institute_admin | 2 orgs (shows org picker) |
| teacher1 | teacher123 | teacher | 1 org (direct login) |
| student1 | student123 | student | 1 org (direct login) |

Login requires only username + password — no Organization ID.

## Quick Verification

```bash
# GraphQL playground
open http://localhost:3000/api/graphql

# Login mutation (single-org user → direct JWT)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"teacher1\", password: \"teacher123\") { accessToken user { username } } }"}'

# Login mutation (multi-org user → platform token + membership list)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { platformToken memberships { orgName roleName tenantId } } }"}'

# Select organization (use platformToken from above)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PLATFORM_TOKEN>" \
  -d '{"query":"mutation { selectOrganization(tenantId: \"<TENANT_ID>\") { accessToken user { username } } }"}'
```

## Running Tests

```bash
bun run test                     # all unit tests
bun run e2e                      # e2e tests (requires running API)
nx affected -t test              # only changed projects
```

## Dev Scripts

```bash
# Dev environment
tilt up                  # Start everything (infra + apps)
tilt down                # Stop everything

# Individual apps (if not using Tilt)
bun run dev:gateway      # API gateway               (port 3000)
bun run dev:institute    # Institute service
bun run dev:admin        # Admin portal               (port 4200)
bun run dev:portal       # Institute portal            (port 4300)

# Database
bun run db:migrate:dev   # Interactive dev migrations
bun run db:migrate       # Deploy migrations (CI)
bun run db:generate      # Regenerate Prisma client
bun run db:seed          # Seed test data
bun run db:reset         # Nuke DB + re-migrate

# Code quality
bun run lint             # Biome lint check
bun run lint:fix         # Biome auto-fix
bun run format           # Biome format
bun run typecheck        # TypeScript type checking
```
