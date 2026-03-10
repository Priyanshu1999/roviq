# Database Tilt Resources — Design

**Goal:** Add database management resources to the Tiltfile so `tilt up` automatically runs migrations and seeds, with manual buttons for cleanup, generation, and Prisma Studio.

**Architecture:** Chain Tilt `local_resource` blocks in dependency order: `pnpm-install` → `db-migrate` (with retry) → `db-seed` (idempotent). Backend services depend on `db-seed` instead of `postgres` directly. Manual resources for `db-clean`, `db-generate`, and `database-gui`.

**Tech Stack:** Tilt, Prisma, pnpm, PostgreSQL

---

## Resource Chain

```
.env copy + dotenv load (Tiltfile evaluation time)
    ↓
docker_compose → postgres, redis, nats, minio, temporal
    ↓
pnpm-install (auto, watches pnpm-lock.yaml)
    ↓
db-migrate (auto, retries 30x waiting for postgres)
    ↓
db-seed (auto, idempotent — skips if already seeded)
    ↓
api-gateway, institute-service (depend on db-seed + redis + nats)
```

## Resources

| Resource | Label | Auto-init | Trigger | Depends on |
|----------|-------|-----------|---------|------------|
| `pnpm-install` | `setup` | yes | `pnpm-lock.yaml` changes | — |
| `db-migrate` | `database` | yes | `libs/prisma-client/prisma/migrations/` changes | `pnpm-install`, `postgres` |
| `db-seed` | `database` | yes | after migrate completes | `db-migrate` |
| `db-clean` | `database` | no (manual) | manual button | `postgres` |
| `db-generate` | `database` | no (manual) | manual button | `pnpm-install` |
| `database-gui` | `database` | no (manual) | manual button | `postgres` |

## Changes

### 1. `package.json` — add `db:studio` script

Uses `DATABASE_URL_ADMIN` to bypass RLS for full data visibility.

### 2. `scripts/seed.ts` — add idempotency check

Early-exit at top of `main()`: query for sentinel org (`demo-institute`), if exists log "Already seeded, skipping" and exit 0. This prevents noisy re-hashing and duplicate logs on every `tilt up`.

### 3. `Tiltfile` — add 6 resources

- **pnpm-install**: `cmd='pnpm install'`, watches `pnpm-lock.yaml`
- **db-migrate**: retry loop (30 attempts, 2s apart), runs `pnpm run db:migrate`, triggers backend restart on success
- **db-seed**: runs `pnpm run db:seed` (idempotent via seed script check)
- **db-clean**: manual, runs `pnpm run db:reset` then triggers `db-migrate`
- **db-generate**: manual, runs `pnpm run db:generate`
- **database-gui**: manual, serves `pnpm run db:studio`

### 4. `Tiltfile` — update backend deps

`api-gateway` and `institute-service` change `resource_deps` from `['postgres', 'redis', 'nats']` to `['db-seed', 'redis', 'nats']` since `db-seed` transitively depends on `postgres`.
