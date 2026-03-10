# Docker Launcher — Design Doc

**Date:** 2026-03-10
**Status:** Draft
**Goal:** Let anyone run the full Roviq platform with a single `docker run` command — no Node.js, no pnpm, no source code.

## User Experience

```bash
docker run -d --name roviq \
  -p 3000:3000 -p 4200:4200 -p 4300:4300 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v roviq-data:/data \
  ghcr.io/roviq-hq/roviq:latest

# Check progress
docker logs -f roviq
```

Output:

```
[roviq] Starting Roviq platform...
[roviq] ✓ Network created
[roviq] ✓ PostgreSQL ready
[roviq] ✓ Redis ready
[roviq] ✓ NATS ready
[roviq] ✓ MinIO ready
[roviq] ✓ Temporal ready
[roviq] ✓ Migrations applied
[roviq] ✓ Seed data loaded
[roviq] ✓ API Gateway ready       → http://localhost:3000/api/graphql
[roviq] ✓ Admin Portal ready      → http://localhost:4200
[roviq] ✓ Institute Portal ready  → http://localhost:4300
[roviq]
[roviq] Roviq is running!
[roviq]
[roviq]   Demo credentials:
[roviq]     admin    / admin123   (2 orgs — shows org picker)
[roviq]     teacher1 / teacher123 (1 org — direct login)
[roviq]     student1 / student123 (1 org — direct login)
```

Stop and clean up: `docker stop roviq && docker rm roviq`

## Architecture

```
User runs: docker run ghcr.io/roviq-hq/roviq:latest
       │
       ▼
┌─────────────┐    Docker socket
│  Launcher   │◄──────────────────┐
│  Container  │                   │
└──────┬──────┘                   │
       │ docker compose up        │
       ▼                          │
┌─────────────────────────────────┴──────────┐
│  roviq-net (Docker network)                │
│                                            │
│  postgres  redis  nats  minio  temporal    │
│                                            │
│  api-gateway :3000                         │
│  admin-portal :4200                        │
│  institute-portal :4300                    │
└────────────────────────────────────────────┘
```

The launcher is a thin Alpine container that:

1. Embeds a `compose.app.yaml` template and the `entrypoint.sh` script
2. Mounts the host Docker socket to orchestrate sibling containers
3. Generates compose config with correct image tags (matching launcher version)
4. Creates a Docker network (`roviq-net`)
5. Runs `docker compose up -d` for infra, waits for health checks
6. Runs migration via a one-shot `api-gateway` container (`pnpx prisma migrate deploy`)
7. Runs seed via a one-shot `api-gateway` container (`pnpx tsx scripts/seed.ts`)
8. Starts app containers
9. Tails all container logs (so `docker logs roviq` shows everything)
10. On `SIGTERM` (`docker stop`), runs `docker compose down` for cleanup

## GHCR Images

| Image | Source | Purpose |
|-------|--------|---------|
| `ghcr.io/roviq-hq/roviq` | `docker/Dockerfile.launcher` | Orchestrator |
| `ghcr.io/roviq-hq/api-gateway` | `docker/Dockerfile.backend` target `api-gateway` | Backend API |
| `ghcr.io/roviq-hq/admin-portal` | `docker/Dockerfile.web` target `admin-portal` | Admin frontend |
| `ghcr.io/roviq-hq/institute-portal` | `docker/Dockerfile.web` target `institute-portal` | Institute frontend |

Tags: `latest` (from main), semver (`v1.0.0`) from git tags.

## File Structure Changes

### Before (current)

```
/
├── docker-compose.yml       ← infra only, ambiguous name
├── compose.dev.yaml         ← dev apps, inconsistent naming
├── Dockerfile               ← backend only, incomplete
├── .env.docker              ← docker env, cluttering root
├── .dockerignore
```

### After

```
/
├── docker/
│   ├── Dockerfile.backend       ← NestJS multi-stage (dev + api-gateway)
│   ├── Dockerfile.web           ← Next.js multi-stage (admin-portal, institute-portal)
│   ├── Dockerfile.launcher      ← Launcher (Alpine + docker compose CLI + entrypoint)
│   ├── compose.infra.yaml       ← Postgres, Redis, NATS, MinIO, Temporal
│   ├── compose.dev.yaml         ← Dev mode: builds from source with watch
│   ├── compose.app.yaml         ← Production: pre-built images from GHCR
│   ├── env.docker               ← Docker-internal env vars
│   └── launcher/
│       └── entrypoint.sh        ← Orchestration script
├── .dockerignore                ← Stays at root (Docker build context)
├── Tiltfile                     ← Updated: references docker/compose.infra.yaml
├── scripts/
│   └── init-db.sh               ← Stays (shared across modes)
```

### Naming rationale

| Old | New | Why |
|-----|-----|-----|
| `docker-compose.yml` | `docker/compose.infra.yaml` | Descriptive, not the implicit default |
| `compose.dev.yaml` | `docker/compose.dev.yaml` | Grouped with Docker config |
| `Dockerfile` | `docker/Dockerfile.backend` | Clarifies what it builds |
| `.env.docker` | `docker/env.docker` | Not hidden config, belongs with Docker files |
| _(new)_ | `docker/Dockerfile.web` | Next.js standalone builds |
| _(new)_ | `docker/Dockerfile.launcher` | Launcher image |
| _(new)_ | `docker/compose.app.yaml` | Production compose for launcher |

## Dockerfiles

### Dockerfile.backend (existing, moved + cleaned up)

Multi-stage: `base` → `dev` → `build` → `api-gateway`

No changes to build logic, just moved to `docker/`.

### Dockerfile.web (new)

Multi-stage Next.js build using `output: 'standalone'`:

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY . .
RUN pnpx prisma generate --schema=libs/backend/prisma-client/prisma/schema.prisma
ARG APP_NAME
RUN pnpx nx build ${APP_NAME}

FROM node:22-alpine AS admin-portal
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin-portal/.next/standalone ./
COPY --from=build /app/apps/admin-portal/.next/static ./apps/admin-portal/.next/static
COPY --from=build /app/apps/admin-portal/public ./apps/admin-portal/public
EXPOSE 4200
CMD ["node", "apps/admin-portal/server.js"]

FROM node:22-alpine AS institute-portal
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/institute-portal/.next/standalone ./
COPY --from=build /app/apps/institute-portal/.next/static ./apps/institute-portal/.next/static
COPY --from=build /app/apps/institute-portal/public ./apps/institute-portal/public
EXPOSE 4300
CMD ["node", "apps/institute-portal/server.js"]
```

**Prerequisite:** Both Next.js apps need `output: 'standalone'` in their `next.config.js`.

### Dockerfile.launcher (new)

```dockerfile
FROM docker/compose:latest AS compose-bin

FROM alpine:3.21
RUN apk add --no-cache bash curl jq

COPY --from=compose-bin /usr/local/bin/docker-compose /usr/local/bin/docker
COPY docker/compose.app.yaml /app/compose.yaml
COPY docker/launcher/entrypoint.sh /app/entrypoint.sh
COPY scripts/init-db.sh /app/init-db.sh

WORKDIR /app
RUN chmod +x /app/entrypoint.sh

ENV ROVIQ_VERSION=latest

ENTRYPOINT ["/app/entrypoint.sh"]
```

## compose.app.yaml (used by launcher)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    networks: [roviq-net]
    environment:
      POSTGRES_USER: roviq
      POSTGRES_PASSWORD: roviq_dev
      POSTGRES_DB: roviq
    volumes:
      - roviq-pgdata:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U roviq"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    networks: [roviq-net]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  nats:
    image: nats:2.10-alpine
    networks: [roviq-net]
    command: ["--jetstream", "--store_dir=/data", "-m", "8222"]
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:8222/healthz"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    networks: [roviq-net]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: roviq_minio
      MINIO_ROOT_PASSWORD: roviq_minio_dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 5

  temporal:
    image: temporalio/auto-setup:latest
    networks: [roviq-net]
    environment:
      DB: postgres12
      DB_PORT: 5432
      POSTGRES_USER: roviq
      POSTGRES_PWD: roviq_dev
      POSTGRES_SEEDS: postgres
    depends_on:
      postgres:
        condition: service_healthy

  temporal-ui:
    image: temporalio/ui:latest
    networks: [roviq-net]
    environment:
      TEMPORAL_ADDRESS: temporal:7233

  api-gateway:
    image: ghcr.io/roviq-hq/api-gateway:${ROVIQ_VERSION:-latest}
    networks: [roviq-net]
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://roviq:roviq_dev@postgres:5432/roviq
      DATABASE_URL_ADMIN: postgresql://roviq_admin:roviq_admin_dev@postgres:5432/roviq
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats:4222
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: roviq_minio
      S3_SECRET_KEY: roviq_minio_dev
      S3_BUCKET_PREFIX: roviq-
      TEMPORAL_ADDRESS: temporal:7233
      JWT_SECRET: roviq-quickstart-jwt-secret
      JWT_REFRESH_SECRET: roviq-quickstart-refresh-secret
      JWT_EXPIRATION: 15m
      JWT_REFRESH_EXPIRATION: 7d
      API_GATEWAY_PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      nats:
        condition: service_healthy

  admin-portal:
    image: ghcr.io/roviq-hq/admin-portal:${ROVIQ_VERSION:-latest}
    networks: [roviq-net]
    ports: ["4200:4200"]
    environment:
      PORT: 4200
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_WS_URL: ws://localhost:3000
    depends_on:
      api-gateway:
        condition: service_started

  institute-portal:
    image: ghcr.io/roviq-hq/institute-portal:${ROVIQ_VERSION:-latest}
    networks: [roviq-net]
    ports: ["4300:4300"]
    environment:
      PORT: 4300
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_WS_URL: ws://localhost:3000
    depends_on:
      api-gateway:
        condition: service_started

networks:
  roviq-net:

volumes:
  roviq-pgdata:
```

## Launcher Entrypoint Script

`docker/launcher/entrypoint.sh` — high-level flow:

```bash
#!/bin/bash
set -euo pipefail

COMPOSE_PROJECT=roviq
COMPOSE_FILE=/app/compose.yaml

log() { echo "[roviq] $*"; }

# Trap SIGTERM for clean shutdown
cleanup() {
  log "Shutting down..."
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down
  log "Stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

# 1. Start infra
log "Starting Roviq platform..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d postgres redis nats minio temporal temporal-ui
log "Waiting for infrastructure..."

# 2. Wait for health checks
for svc in postgres redis nats; do
  until docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps "$svc" | grep -q "healthy"; do
    sleep 2
  done
  log "✓ $(echo $svc | sed 's/.*/\u&/') ready"
done

# 3. Run migrations (one-shot container)
log "Running migrations..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" run --rm \
  api-gateway sh -c "pnpx prisma migrate deploy --schema=libs/backend/prisma-client/prisma/schema.prisma"
log "✓ Migrations applied"

# 4. Run seed (one-shot container)
log "Seeding database..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" run --rm \
  api-gateway sh -c "pnpx tsx scripts/seed.ts"
log "✓ Seed data loaded"

# 5. Start app containers
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d api-gateway admin-portal institute-portal
log "✓ API Gateway ready       → http://localhost:3000/api/graphql"
log "✓ Admin Portal ready      → http://localhost:4200"
log "✓ Institute Portal ready  → http://localhost:4300"
log ""
log "Roviq is running!"
log ""
log "  Demo credentials:"
log "    admin    / admin123   (2 orgs — shows org picker)"
log "    teacher1 / teacher123 (1 org — direct login)"
log "    student1 / student123 (1 org — direct login)"

# 6. Tail logs (keeps container alive)
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" logs -f &
wait $!
```

**Note:** The migration/seed one-shot approach won't work with the production `api-gateway` image as-is — it only has `dist/main.js`, no Prisma CLI or seed script. Two options:

- **Option A:** Build a separate `migrator` image from `Dockerfile.backend` `build` stage that includes Prisma + seed script
- **Option B:** Embed migration/seed in the launcher image itself

**Recommended: Option A** — a `migrator` stage in `Dockerfile.backend` that has the Prisma CLI, migration files, and seed script. The launcher runs it as a one-shot container.

## Dockerfile.backend — Updated with migrator stage

```dockerfile
# ... existing base, dev, build, api-gateway stages ...

# ── Migrator: Prisma CLI + seed for one-shot operations ──
FROM base AS migrator

COPY . .
RUN pnpx prisma generate --schema=libs/backend/prisma-client/prisma/schema.prisma

# Default: run migrations
CMD ["pnpx", "prisma", "migrate", "deploy", "--schema=libs/backend/prisma-client/prisma/schema.prisma"]
```

This adds `ghcr.io/roviq-hq/migrator` to the image list. The launcher runs:
- `docker run --rm ghcr.io/roviq-hq/migrator:latest` — migrations
- `docker run --rm ghcr.io/roviq-hq/migrator:latest pnpx tsx scripts/seed.ts` — seed

## Tiltfile Updates

```python
docker_compose('./docker/compose.infra.yaml')
```

All other Tiltfile references remain the same (they use `pnpm run` commands, not Docker files).

## package.json Script Updates

```json
"infra:up": "docker compose -f docker/compose.infra.yaml up -d",
"infra:down": "docker compose -f docker/compose.infra.yaml down",
"dev:docker": "docker compose -f docker/compose.dev.yaml up --watch",
"dev:docker:build": "docker compose -f docker/compose.dev.yaml up --watch --build",
"dev:docker:down": "docker compose -f docker/compose.dev.yaml down"
```

## CI: GitHub Actions

New workflow `.github/workflows/publish-images.yaml`:

- **Trigger:** push to `main`, tag `v*`
- **Matrix build:** `api-gateway`, `admin-portal`, `institute-portal`, `migrator`, `roviq` (launcher)
- **Tags:** `latest` on main pushes, semver on `v*` tags
- **Registry:** GHCR with `GITHUB_TOKEN` (zero extra secrets)
- **Cache:** GitHub Actions cache for Docker layers

## Prerequisites Before Implementation

1. **Next.js standalone output** — both portals need `output: 'standalone'` in `next.config.js`
2. **Prisma schema path** — migrator needs access to `libs/backend/prisma-client/prisma/`
3. **Seed script** — must be included in the migrator image build context

## Does NOT Change

- Tilt dev workflow (still `tilt up`)
- Local `.env` / `.env.example` setup
- Database schema or seed logic
- App source code
