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
open http://localhost:3005/api/graphql

# Health check
curl http://localhost:3005/api/health

# Observability (also accessible via web app → Observability)
open http://localhost:3001/d/roviq-overview  # Grafana dashboard
open http://localhost:9090                   # Prometheus
open http://localhost:3200                   # Tempo

# Institute login (single institute → direct JWT)
curl -s http://localhost:3005/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { instituteLogin(username: \"teacher1\", password: \"teacher123\") { accessToken user { username } } }"}'

# Institute login (multi-institute → membership picker)
curl -s http://localhost:3005/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { instituteLogin(username: \"admin\", password: \"admin123\") { requiresInstituteSelection memberships { membershipId instituteName roleName tenantId } } }"}'

# Select institute (use any valid token from above)
curl -s http://localhost:3005/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"query":"mutation { selectInstitute(membershipId: \"<MEMBERSHIP_ID>\") { accessToken user { username } } }"}'

# Admin login (platform scope)
curl -s http://localhost:3005/api/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { adminLogin(username: \"admin\", password: \"admin123\") { accessToken user { username scope } } }"}'
```

## Running Tests

```bash
pnpm run test                     # unit + integration (nx run-many -t test)
pnpm run test:int                 # integration tests only (real DB, roviq_test)
pnpm run test:e2e:api             # Vitest E2E API (requires pnpm e2e:up)
pnpm run test:e2e:hurl            # Hurl domain workflow tests (requires pnpm e2e:up)
pnpm run test:e2e:ui              # Playwright UI tests across 3 portals (requires pnpm e2e:up)
pnpm run test:all                 # full pipeline: unit + int + e2e:api + e2e:hurl + e2e:ui
nx affected -t test               # only changed projects
```

## Dev Scripts

```bash
# Dev environment
tilt up                  # Start everything (infra + apps)
tilt down                # Stop everything

# Individual apps (if not using Tilt)
pnpm run dev:gateway      # API gateway               (port 3005)
pnpm run dev:web          # Web app                     (port 4200)

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
