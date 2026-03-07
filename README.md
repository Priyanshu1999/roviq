<div align="center">

# Roviq

**Multi-tenant institute management platform**

[![CI](https://github.com/Priyanshu1999/roviq/actions/workflows/ci.yml/badge.svg)](https://github.com/Priyanshu1999/roviq/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=000)](https://bun.sh/)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-API-e10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![Nx](https://img.shields.io/badge/Nx-22-143055?logo=nx&logoColor=white)](https://nx.dev/)

</div>

---

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
| Dev | Tilt, Nx 22, Bun, Biome |
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
│   ├── auth/                 # Frontend auth context + guards
│   └── i18n/                 # next-intl config, routing, formatting
├── e2e/                      # E2E tests
├── scripts/                  # DB init + seed scripts
├── Tiltfile                  # Dev environment orchestration
└── docs/                     # Detailed documentation
```

## Quick Start

```bash
# Prerequisites: Node.js 20+, Bun, Docker, Tilt

bun install
cp .env.example .env

tilt up

# In a separate terminal:
bun run db:migrate:dev
bun run db:seed

# Open Tilt UI: http://localhost:10350
# API: http://localhost:3000/api/graphql
# Admin Portal: http://localhost:4200
# Institute Portal: http://localhost:4300
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
bun run test                  # Unit tests
bun run e2e                   # E2E tests (requires running API)
nx affected -t test           # Only changed projects
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Auth & Authorization](docs/auth.md)
- [Infrastructure](docs/infrastructure.md)
- [Testing](docs/testing.md)
- [Frontend](docs/frontend.md)
