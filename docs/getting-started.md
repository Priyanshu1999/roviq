# Getting Started

## Prerequisites

- Node.js 20+
- Bun (package manager)
- Docker Desktop
- dotenvx (`bun add -g @dotenvx/dotenvx`)

## Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd roviq
bun install

# 2. Start infrastructure
docker compose up -d

# 3. Set up environment
# .env.development is already committed (dotenvx encrypted)
# Get .env.keys from a team member and place it at the repo root
# Or generate your own: dotenvx encrypt -f .env.development

# 4. Run database migrations
bun run db:migrate

# 5. Seed test data
bun run db:seed

# 6. Start services
bun run dev:gateway    # http://localhost:3000
bun run dev:admin      # http://localhost:3001
```

## Test Credentials

| Username | Password | Role | Abilities |
|----------|----------|------|-----------|
| admin | admin123 | institute_admin | manage all |
| teacher1 | teacher123 | teacher | read students, CRUD attendance |
| student1 | student123 | student | read own attendance |

Tenant ID: output from seed script (check console).

## Quick Verification

```bash
# GraphQL playground
open http://localhost:3000/graphql

# Login mutation
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\", tenantId: \"<TENANT_ID>\") { accessToken user { username abilityRules } } }"}'
```

## Running Tests

```bash
nx run-many -t test              # all unit tests
nx run api-gateway-e2e:e2e       # e2e tests (requires running API)
nx run-many -t test e2e          # everything
nx affected -t test              # only changed projects
```

## Dev Scripts

```bash
bun run dev:gateway    # API gateway with dotenvx
bun run dev:institute  # Institute service with dotenvx
bun run dev:admin      # Admin portal with dotenvx
bun run dev:portal     # Institute portal with dotenvx
bun run dev:docker     # All services via Docker Compose (watch mode)
bun run lint           # Biome lint check
bun run lint:fix       # Biome auto-fix
bun run format         # Biome format
bun run typecheck      # TypeScript type checking
bun run db:migrate     # Run Prisma migrations
bun run db:seed        # Seed test data
```
