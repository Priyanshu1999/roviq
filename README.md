# Roviq

Multi-tenant education platform for managing institutes, students, attendance, timetables, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, GraphQL (Apollo Server 5), Prisma 7 |
| Frontend | Next.js 16 (App Router, Turbopack), React 19 |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI |
| Auth | JWT (argon2id), Passport, CASL |
| Database | PostgreSQL 16 with Row Level Security |
| Cache | Redis 7 (ioredis) |
| Messaging | NATS 2.10 JetStream |
| Monorepo | Nx 22, Bun, Biome |
| Testing | Vitest 4 |

## Project Structure

```
roviq/
├── apps/
│   ├── api-gateway/          # NestJS — GraphQL API entry point
│   ├── institute-service/    # NestJS — institute business logic
│   ├── admin-portal/         # Next.js — platform admin UI
│   └── institute-portal/     # Next.js — institute-facing UI
├── libs/
│   ├── prisma-client/        # Prisma + RLS tenant extensions
│   ├── common-types/         # Shared CASL action/subject types
│   ├── nats-utils/           # JetStream messaging + circuit breakers
│   ├── ui/                   # shadcn/ui components + layout
│   ├── graphql/              # Apollo Client setup
│   └── auth/                 # Frontend auth context + guards
├── e2e/                      # E2E tests
├── scripts/                  # DB init + seed scripts
└── docs/                     # Detailed documentation
```

## Quick Start

```bash
# Prerequisites: Node.js 20+, Bun, Docker, dotenvx

bun install
docker compose up -d

# Get .env.keys from a team member (decrypts .env.development)
bun run db:migrate
bun run db:seed

# Start developing
bun run dev:gateway    # API — http://localhost:3000
bun run dev:admin      # Admin portal — http://localhost:3001
```

See [docs/getting-started.md](docs/getting-started.md) for full setup instructions.

## Development

```bash
bun run lint           # Biome lint
bun run lint:fix       # Biome auto-fix
bun run format         # Biome format
bun run typecheck      # TypeScript type checking
```

## Testing

```bash
nx run-many -t test           # Unit tests
nx run api-gateway-e2e:e2e    # E2E tests (requires running API)
nx affected -t test           # Only changed projects
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Auth & Authorization](docs/auth.md)
- [Infrastructure](docs/infrastructure.md)
- [Testing](docs/testing.md)
- [Frontend](docs/frontend.md)
