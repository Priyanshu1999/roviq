# Getting Started

## Prerequisites

- Node.js 20+
- pnpm (package manager)
- Docker Desktop
- [Tilt](https://docs.tilt.dev/install.html) (dev environment orchestrator)

## Setup

```bash
git clone https://github.com/Roviq-HQ/roviq.git && cd roviq
tilt up
```

Tilt handles everything automatically:
- Creates `.env` from `.env.example` on first run
- Installs dependencies (`pnpm install`)
- Starts infra (Postgres, Redis, NATS, MinIO, Temporal, OTel/Grafana stack) in Docker
- Pushes Drizzle schema to database and seeds test data
- Starts all apps locally

Open the Tilt UI at http://localhost:10350 to monitor all resources.

## Test Credentials

| Username | Password | Role | Orgs |
|----------|----------|------|------|
| admin | admin123 | institute_admin | 2 institutes (shows institute picker) |
| teacher1 | teacher123 | teacher | 1 institute (direct login) |
| student1 | student123 | student | 1 institute (direct login) |

Login requires only username + password — no Institute ID.

## Quick Verification

```bash
# GraphQL playground
open http://localhost:3000/api/graphql

# Health check
curl http://localhost:3000/api/health

# Observability (also accessible via admin-portal → Observability)
open http://localhost:3001/d/roviq-overview  # Grafana dashboard
open http://localhost:9090                   # Prometheus
open http://localhost:3200                   # Tempo

# Login mutation (single-institute user → direct JWT)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"teacher1\", password: \"teacher123\") { accessToken user { username } } }"}'

# Login mutation (multi-institute user → platform token + membership list)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { platformToken memberships { instituteName roleName tenantId } } }"}'

# Select institute (use platformToken from above)
curl -s http://localhost:3000/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PLATFORM_TOKEN>" \
  -d '{"query":"mutation { selectInstitute(tenantId: \"<TENANT_ID>\") { accessToken user { username } } }"}'
```

## Running Tests

```bash
pnpm run test                     # all unit tests
pnpm run e2e                      # e2e tests (requires running API)
nx affected -t test              # only changed projects
```

## Dev Scripts

```bash
# Dev environment
tilt up                  # Start everything (infra + apps)
tilt down                # Stop everything

# Individual apps (if not using Tilt)
pnpm run dev:gateway      # API gateway               (port 3000)
pnpm run dev:admin        # Admin portal               (port 4200)
pnpm run dev:portal       # Institute portal            (port 4300)

# Database (handled automatically by Tilt, but available manually)
pnpm run db:push          # Push Drizzle schema to DB
pnpm run db:seed          # Seed test data
pnpm run db:reset         # Nuke DB + re-push schema
pnpm run db:reset --seed  # Nuke + push + seed in one step
pnpm run db:studio        # Drizzle Studio (visual DB browser)

# Code quality
pnpm run lint             # Biome lint check
pnpm run lint:fix         # Biome auto-fix
pnpm run format           # Biome format
pnpm run typecheck        # TypeScript type checking
```
