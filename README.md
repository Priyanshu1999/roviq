<div align="center">

# Roviq

**The open-source platform to run your institute**

[![CI](https://github.com/Roviq-HQ/roviq/actions/workflows/ci.yml/badge.svg)](https://github.com/Roviq-HQ/roviq/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Last Commit](https://img.shields.io/github/last-commit/Roviq-HQ/roviq)](https://github.com/Roviq-HQ/roviq/commits)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![NX](https://img.shields.io/badge/NX-143055?logo=nx&logoColor=white)](https://nx.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

<a href="docs/">Docs</a> · <a href="https://github.com/Roviq-HQ/roviq/issues">Issues</a>

</div>

---

## Why Roviq

**Built for institute staff, not IT departments.** Most actions take fewer than 3 clicks. AI handles the tedious work — generating timetables, detecting attendance anomalies, auto-filling forms — so staff don't have to.

**One platform, not five.** Admissions, attendance, timetables, fees, and reporting in a single system. No juggling between disconnected tools.

**Your data, your control.** Open source, open API, self-hostable. No vendor lock-in, no data hostage.

## Quick Start

Requires: [Node.js 20+](https://nodejs.org/), [pnpm](https://pnpm.io/), [Docker](https://www.docker.com/), [Tilt](https://tilt.dev/)

```bash
git clone https://github.com/Roviq-HQ/roviq.git
cd roviq
tilt up
```

Tilt handles everything — dependencies, environment setup, database migrations, and seeding.

Then open http://localhost:4200 (Admin Portal) or http://localhost:4300 (Institute Portal).

Full guide: [Getting Started](docs/getting-started.md)

## Documentation

- [Getting Started](docs/getting-started.md) — full setup walkthrough
- [Architecture](docs/architecture.md) — system design and project structure
- [Auth & Authorization](docs/auth.md) — how authentication and permissions work
- [Infrastructure](docs/infrastructure.md) — database, messaging, and services
- [Testing](docs/testing.md) — running and writing tests
- [Frontend](docs/frontend.md) — UI patterns and conventions

## Roadmap

- [x] Platform foundation
- [ ] Multi-tenant institute onboarding
- [ ] User authentication and role-based access
- [ ] Admin Portal — manage institutes, subscriptions, and support
- [ ] Institute Portal — dashboards, staff, and daily operations
- [ ] Timetable and attendance management
- [ ] Fee collection and financial reporting
- [ ] DIKSHA content integration
- [ ] UDISE-compatible reporting and compliance

Track progress on [GitHub Issues](https://github.com/Roviq-HQ/roviq/issues).

## Project Structure

```
roviq/
├── apps/
│   ├── api-gateway/            # GraphQL gateway — auth, audit, routing
│   ├── admin-portal/           # Super admin UI (Next.js)
│   └── institute-portal/       # Institute-facing UI (Next.js)
├── libs/
│   ├── prisma-client/          # Prisma + RLS tenant extensions
│   ├── common-types/           # Shared types, CASL subjects/actions
│   ├── nats-utils/             # JetStream helpers, circuit breakers
│   ├── ui/                     # shadcn/ui component library
│   ├── graphql/                # Apollo Client config
│   ├── auth/                   # Auth context, guards, token utils
│   └── i18n/                   # next-intl config, locale routing
├── e2e/                        # End-to-end tests
├── scripts/                    # DB init, seed, migration helpers
├── docs/                       # Architecture decisions, specs
└── Tiltfile                    # Local dev orchestration
```

---

<div align="center">

Built by [@priyanshu0x](https://github.com/priyanshu0x)

</div>
