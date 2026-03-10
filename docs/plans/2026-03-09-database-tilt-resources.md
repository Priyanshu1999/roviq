# Database Tilt Resources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add database management resources to the Tiltfile so `tilt up` auto-migrates and seeds, with manual buttons for cleanup, generation, and Prisma Studio.

**Architecture:** Chain `local_resource` blocks: `pnpm-install` → `db-migrate` (retry loop) → `db-seed` (idempotent). Backend services depend on `db-seed` instead of `postgres`. Manual resources for db-clean, db-generate, database-gui.

**Tech Stack:** Tilt, Prisma, pnpm, PostgreSQL

**Design doc:** `docs/plans/2026-03-09-database-tilt-resources-design.md`

---

### Task 1: Add `db:studio` script to package.json

**Files:**
- Modify: `package.json:26` (after `db:reset` line)

**Step 1: Add the script**

In `package.json`, add this line after the `db:reset` script:

```json
"db:studio": "bash -c 'cd libs/prisma-client && DATABASE_URL=$DATABASE_URL_ADMIN pnpx prisma studio'",
```

**Step 2: Verify the script is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(dx): add db:studio script for Prisma Studio with admin access"
```

---

### Task 2: Make seed script idempotent

**Files:**
- Modify: `scripts/seed.ts:7-13` (top of `main()` function)

**Step 1: Add early-exit check**

Add this block at the top of the `main()` function in `scripts/seed.ts`, right after `const prisma = createAdminClient(...)` (line 11) and before the `console.log('Seeding database...')` line (line 13):

```typescript
  // Skip if already seeded (idempotency for Tilt auto-run)
  const existing = await prisma.organization.findUnique({
    where: { slug: 'demo-institute' },
  });
  if (existing) {
    console.log('Database already seeded, skipping.');
    process.exit(0);
  }
```

After this change, lines 12-18 of the file should read:

```typescript
  const prisma = createAdminClient(new PrismaClient({ adapter }));

  // Skip if already seeded (idempotency for Tilt auto-run)
  const existing = await prisma.organization.findUnique({
    where: { slug: 'demo-institute' },
  });
  if (existing) {
    console.log('Database already seeded, skipping.');
    process.exit(0);
  }

  console.log('Seeding database...');
```

**Step 2: Verify syntax**

Run: `pnpx tsx --eval "import('./scripts/seed.ts')" 2>&1 | head -5`
Expected: No syntax errors (it will fail to connect to DB, that's fine — we're checking syntax only)

**Step 3: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(dx): add idempotency check to seed script"
```

---

### Task 3: Add `pnpm-install` Tilt resource

**Files:**
- Modify: `Tiltfile:17` (insert before the `docker_compose` line)

**Step 1: Add the resource**

Insert this block in the Tiltfile at line 17, right before `# Infrastructure (Postgres, Redis, NATS, MinIO, Temporal)`:

```python
# Package manager — auto-runs on lockfile changes
local_resource(
  'pnpm-install',
  cmd='pnpm install',
  deps=['package.json'],
  labels=['setup'],
)
```

**Step 2: Verify Tiltfile syntax**

Run: `python3 -c "open('Tiltfile').read(); print('File readable')"` (basic check — Tilt uses Starlark, not Python, but readability confirms no obvious issues)

**Step 3: Commit**

```bash
git add Tiltfile
git commit -m "feat(dx): add pnpm-install Tilt resource"
```

---

### Task 4: Add `db-migrate` Tilt resource

**Files:**
- Modify: `Tiltfile` (insert after infra `dc_resource` blocks, before backend resources)

**Step 1: Add the resource**

Insert this block after the `dc_resource('temporal-ui', ...)` line and before the `# API Gateway` comment:

```python
# Database migrations — auto-runs, retries until postgres is ready
local_resource(
  'db-migrate',
  cmd='''
    for i in $(seq 1 30); do
      if pnpm run db:migrate 2>/dev/null; then
        echo "Migration completed successfully"
        exit 0
      fi
      echo "Waiting for PostgreSQL... (attempt $i/30)"
      sleep 2
    done
    echo "Migration failed after 30 attempts"
    exit 1
  ''',
  deps=['libs/prisma-client/prisma/migrations'],
  resource_deps=['pnpm-install', 'postgres'],
  labels=['database'],
)
```

**Step 2: Commit**

```bash
git add Tiltfile
git commit -m "feat(dx): add db-migrate Tilt resource with retry logic"
```

---

### Task 5: Add `db-seed` Tilt resource

**Files:**
- Modify: `Tiltfile` (insert after `db-migrate` resource)

**Step 1: Add the resource**

Insert this block right after the `db-migrate` resource:

```python
# Database seed — auto-runs after migration, skips if already seeded
local_resource(
  'db-seed',
  cmd='pnpm run db:seed',
  resource_deps=['db-migrate'],
  labels=['database'],
)
```

**Step 2: Commit**

```bash
git add Tiltfile
git commit -m "feat(dx): add db-seed Tilt resource"
```

---

### Task 6: Add manual database resources (`db-clean`, `db-generate`, `database-gui`)

**Files:**
- Modify: `Tiltfile` (insert after `db-seed` resource)

**Step 1: Add all three manual resources**

Insert this block after the `db-seed` resource:

```python
# Database cleanup — manual trigger, nukes DB and re-triggers migration
local_resource(
  'db-clean',
  cmd='pnpm run db:reset && tilt trigger db-migrate && tilt trigger db-seed',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['database'],
)

# Prisma client generation — manual trigger
local_resource(
  'db-generate',
  cmd='pnpm run db:generate',
  resource_deps=['pnpm-install'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['database'],
)

# Prisma Studio — manual trigger, serves on default port (5555)
local_resource(
  'database-gui',
  serve_cmd='pnpm run db:studio',
  resource_deps=['postgres'],
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  labels=['database'],
  links=['http://localhost:5555'],
)
```

**Step 2: Commit**

```bash
git add Tiltfile
git commit -m "feat(dx): add db-clean, db-generate, and database-gui Tilt resources"
```

---

### Task 7: Update backend service dependencies

**Files:**
- Modify: `Tiltfile` — `api-gateway` resource (line ~35 after all insertions)
- Modify: `Tiltfile` — `institute-service` resource (line ~44 after all insertions)

**Step 1: Update api-gateway**

Change the `resource_deps` in the `api-gateway` resource from:

```python
  resource_deps=['postgres', 'redis', 'nats'],
```

to:

```python
  resource_deps=['db-seed', 'redis', 'nats'],
```

**Step 2: Update institute-service**

Change the `resource_deps` in the `institute-service` resource from:

```python
  resource_deps=['postgres', 'redis', 'nats'],
```

to:

```python
  resource_deps=['db-seed', 'redis', 'nats'],
```

**Step 3: Commit**

```bash
git add Tiltfile
git commit -m "feat(dx): backend services depend on db-seed for full startup chain"
```

---

### Task 8: Verify full Tiltfile

**Step 1: Run lint**

Run: `pnpm run lint`
Expected: Zero errors

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: Zero errors

**Step 3: Smoke test Tilt parse**

Run: `tilt ci --timeout 5s 2>&1 | head -20` (this will fail on timeout but confirms Tiltfile parses correctly — look for "Tilt started" not "Tiltfile error")

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(dx): address lint/typecheck issues from Tilt resource additions"
```
