# Libs Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize `libs/` into `shared/`, `backend/`, `frontend/` subdirectories, and extract casl/prisma/redis modules from api-gateway into reusable backend libs.

**Architecture:** Move existing 7 libs into layer-based subdirectories. Extract 3 NestJS modules from `apps/api-gateway/src/` into new `@roviq/casl`, `@roviq/nestjs-prisma`, `@roviq/redis` libs under `libs/backend/`. Keep `AbilityGuard` and `CurrentAbility` decorator in api-gateway (GraphQL-specific). Move `AuthUser` type to `@roviq/common-types` so `@roviq/casl` can reference it without depending on the gateway.

**Tech Stack:** NX 22, TypeScript, NestJS, CASL, Prisma, ioredis

---

## Important Notes

- All relative paths in `project.json`, `tsconfig.json`, `tsconfig.lib.json` change from `../../` to `../../../` due to one extra nesting level.
- `$schema` paths in `project.json` also gain one level: `../../../node_modules/nx/schemas/project-schema.json`.
- `@roviq/*` import paths stay the same — only `tsconfig.base.json` path mappings change.
- The `prisma-client` lib has a `prisma.config.ts` that references `prisma/schema/` — its relative paths must also update.
- Backend libs that need `@nx/js:tsc` build: `nestjs-prisma`, `casl`, `redis` (they export NestJS modules used at runtime). Frontend libs with no explicit build target keep `targets: {}`.

## Dependency Chain

Tasks must be done in this order because later tasks depend on earlier ones:

1. Move existing libs to subdirectories (Tasks 1-2) — everything else imports from these
2. Create new backend libs (Tasks 3-5) — these replace gateway-internal modules
3. Update gateway imports (Task 6) — rewire the gateway to use new libs
4. Clean up and verify (Task 7)

---

### Task 1: Move existing libs into subdirectories

**Files:**
- Move: `libs/common-types/` → `libs/shared/common-types/`
- Move: `libs/prisma-client/` → `libs/backend/prisma-client/`
- Move: `libs/nats-utils/` → `libs/backend/nats-utils/`
- Move: `libs/auth/` → `libs/frontend/auth/`
- Move: `libs/graphql/` → `libs/frontend/graphql/`
- Move: `libs/i18n/` → `libs/frontend/i18n/`
- Move: `libs/ui/` → `libs/frontend/ui/`

**Step 1: Create directory structure and move libs**

```bash
mkdir -p libs/shared libs/backend libs/frontend

# Shared
mv libs/common-types libs/shared/

# Backend
mv libs/prisma-client libs/backend/
mv libs/nats-utils libs/backend/

# Frontend
mv libs/auth libs/frontend/
mv libs/graphql libs/frontend/
mv libs/i18n libs/frontend/
mv libs/ui libs/frontend/
```

**Step 2: Update `tsconfig.base.json` path aliases**

All paths change from `libs/<name>/` to `libs/<layer>/<name>/`:

```json
{
  "paths": {
    "@roviq/prisma-client": ["libs/backend/prisma-client/src/index.ts"],
    "@roviq/common-types": ["libs/shared/common-types/src/index.ts"],
    "@roviq/nats-utils": ["libs/backend/nats-utils/src/index.ts"],
    "@roviq/ui": ["libs/frontend/ui/src/index.ts"],
    "@roviq/ui/*": ["libs/frontend/ui/src/*"],
    "@roviq/graphql": ["libs/frontend/graphql/src/index.ts"],
    "@roviq/auth": ["libs/frontend/auth/src/index.ts"],
    "@roviq/i18n": ["libs/frontend/i18n/src/index.ts"]
  }
}
```

**Step 3: Update relative paths in every moved lib**

Each lib's `project.json`, `tsconfig.json`, and `tsconfig.lib.json` has relative paths that go up to the repo root. With one more directory level, `../../` becomes `../../../`.

For each of these 7 libs, update:

- `project.json`: `$schema` from `../../node_modules/...` → `../../../node_modules/...`
- `project.json`: `sourceRoot` from `libs/<name>/src` → `libs/<layer>/<name>/src`
- `project.json`: build `outputPath`, `main`, `tsConfig`, `assets` paths (for libs that have build targets: `common-types`, `prisma-client`, `nats-utils`)
- `tsconfig.json`: `extends` from `../../tsconfig.base.json` → `../../../tsconfig.base.json`
- `tsconfig.lib.json`: `outDir` from `../../dist/out-tsc` → `../../../dist/out-tsc`
- `vitest.config.ts`: if it references workspace root paths, update those too

Example for `libs/shared/common-types/project.json`:

```json
{
  "name": "common-types",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/shared/common-types/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/common-types",
        "main": "libs/shared/common-types/src/index.ts",
        "tsConfig": "libs/shared/common-types/tsconfig.lib.json",
        "assets": ["libs/shared/common-types/*.md"]
      }
    }
  },
  "tags": []
}
```

Example for `libs/shared/common-types/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  ...
}
```

Example for `libs/shared/common-types/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    ...
  },
  ...
}
```

Repeat this pattern for all 7 libs. The `name` field in `project.json` stays the same (e.g., `"common-types"`, `"ui"`).

**Step 4: Update `prisma-client` specific paths**

`libs/backend/prisma-client/prisma.config.ts` likely references `prisma/schema/` or `../../` — verify and update.

**Step 5: Run verification**

```bash
pnpm run typecheck
pnpm run test
pnpm run lint
```

Expected: all pass with zero errors. If NX can't find projects, check `project.json` paths.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: reorganize libs into shared/backend/frontend subdirectories"
```

---

### Task 2: Move `AuthUser` type to `@roviq/common-types`

The `AbilityGuard` in api-gateway imports `AuthUser` from `../auth/jwt.strategy`. Since the guard stays in the gateway but `AbilityFactory` moves to `@roviq/casl`, and the factory's `createForUser` already takes `{ userId, tenantId, roleId }` as a plain object (not `AuthUser`), we need `AuthUser` in common-types so the guard can import it from a shared location.

**Files:**
- Modify: `libs/shared/common-types/src/lib/common-types.ts` — add `AuthUser` interface
- Modify: `apps/api-gateway/src/auth/jwt.strategy.ts` — import `AuthUser` from `@roviq/common-types` instead of defining locally

**Step 1: Add `AuthUser` to common-types**

In `libs/shared/common-types/src/lib/common-types.ts`, add:

```typescript
export interface AuthUser {
  userId: string;
  tenantId: string;
  roleId: string;
  type: 'access' | 'platform';
}
```

**Step 2: Update jwt.strategy.ts**

Replace the local `AuthUser` interface with an import:

```typescript
import type { AuthUser } from '@roviq/common-types';
```

Remove the local `export interface AuthUser { ... }` definition.

**Step 3: Run verification**

```bash
pnpm run typecheck
pnpm run test
```

Expected: all pass.

**Step 4: Commit**

```bash
git add libs/shared/common-types/src/lib/common-types.ts apps/api-gateway/src/auth/jwt.strategy.ts
git commit -m "refactor: move AuthUser type to @roviq/common-types"
```

---

### Task 3: Create `@roviq/redis` lib

Extract the Redis NestJS module from api-gateway into a reusable lib.

**Files:**
- Create: `libs/backend/redis/project.json`
- Create: `libs/backend/redis/tsconfig.json`
- Create: `libs/backend/redis/tsconfig.lib.json`
- Create: `libs/backend/redis/src/index.ts`
- Move: `apps/api-gateway/src/redis/redis.constants.ts` → `libs/backend/redis/src/redis.constants.ts`
- Move: `apps/api-gateway/src/redis/redis.module.ts` → `libs/backend/redis/src/redis.module.ts`
- Modify: `tsconfig.base.json` — add `@roviq/redis` path alias

**Step 1: Create lib scaffolding**

`libs/backend/redis/project.json`:

```json
{
  "name": "redis",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/redis/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/redis",
        "main": "libs/backend/redis/src/index.ts",
        "tsConfig": "libs/backend/redis/tsconfig.lib.json",
        "assets": ["libs/backend/redis/*.md"]
      }
    }
  },
  "tags": []
}
```

`libs/backend/redis/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

`libs/backend/redis/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

**Step 2: Move source files**

```bash
mkdir -p libs/backend/redis/src
mv apps/api-gateway/src/redis/redis.constants.ts libs/backend/redis/src/
mv apps/api-gateway/src/redis/redis.module.ts libs/backend/redis/src/
```

**Step 3: Update `redis.module.ts` imports**

The file imports from `./redis.constants` — this stays the same since both files moved together. No changes needed to the source files.

**Step 4: Create barrel export**

`libs/backend/redis/src/index.ts`:

```typescript
export { REDIS_CLIENT } from './redis.constants';
export { RedisModule } from './redis.module';
```

**Step 5: Add path alias to `tsconfig.base.json`**

Add to the `paths` object:

```json
"@roviq/redis": ["libs/backend/redis/src/index.ts"]
```

**Step 6: Delete empty gateway directory**

```bash
rm -r apps/api-gateway/src/redis/
```

**Step 7: Run verification**

```bash
pnpm run typecheck
```

Expected: fails — gateway still imports from `../redis/`. That's expected, we'll fix in Task 6.

**Step 8: Commit**

```bash
git add libs/backend/redis/ tsconfig.base.json
git add -u apps/api-gateway/src/redis/
git commit -m "refactor: extract @roviq/redis lib from api-gateway"
```

---

### Task 4: Create `@roviq/nestjs-prisma` lib

Extract the Prisma NestJS DI modules from api-gateway.

**Files:**
- Create: `libs/backend/nestjs-prisma/project.json`
- Create: `libs/backend/nestjs-prisma/tsconfig.json`
- Create: `libs/backend/nestjs-prisma/tsconfig.lib.json`
- Create: `libs/backend/nestjs-prisma/src/index.ts`
- Move: `apps/api-gateway/src/prisma/prisma.constants.ts` → `libs/backend/nestjs-prisma/src/prisma.constants.ts`
- Move: `apps/api-gateway/src/prisma/prisma.module.ts` → `libs/backend/nestjs-prisma/src/prisma.module.ts`
- Move: `apps/api-gateway/src/prisma/platform-database.module.ts` → `libs/backend/nestjs-prisma/src/platform-database.module.ts`
- Modify: `tsconfig.base.json` — add `@roviq/nestjs-prisma` path alias

**Step 1: Create lib scaffolding**

`libs/backend/nestjs-prisma/project.json`:

```json
{
  "name": "nestjs-prisma",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/nestjs-prisma/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/nestjs-prisma",
        "main": "libs/backend/nestjs-prisma/src/index.ts",
        "tsConfig": "libs/backend/nestjs-prisma/tsconfig.lib.json",
        "assets": ["libs/backend/nestjs-prisma/*.md"]
      }
    }
  },
  "tags": []
}
```

`libs/backend/nestjs-prisma/tsconfig.json` and `tsconfig.lib.json` — same pattern as redis lib (use `../../../` for extends/outDir).

**Step 2: Move source files**

```bash
mkdir -p libs/backend/nestjs-prisma/src
mv apps/api-gateway/src/prisma/prisma.constants.ts libs/backend/nestjs-prisma/src/
mv apps/api-gateway/src/prisma/prisma.module.ts libs/backend/nestjs-prisma/src/
mv apps/api-gateway/src/prisma/platform-database.module.ts libs/backend/nestjs-prisma/src/
```

**Step 3: Update internal imports in moved files**

`prisma.module.ts` imports from `./prisma.constants` — stays the same.
`platform-database.module.ts` imports from `./prisma.constants` — stays the same.
Both import from `@roviq/prisma-client` — stays the same.

No source changes needed.

**Step 4: Create barrel export**

`libs/backend/nestjs-prisma/src/index.ts`:

```typescript
export { ADMIN_PRISMA_CLIENT, PRISMA_CLIENT, TENANT_PRISMA_CLIENT } from './prisma.constants';
export { PrismaModule } from './prisma.module';
export { PlatformDatabaseModule } from './platform-database.module';
```

**Step 5: Add path alias to `tsconfig.base.json`**

```json
"@roviq/nestjs-prisma": ["libs/backend/nestjs-prisma/src/index.ts"]
```

**Step 6: Delete empty gateway directory**

```bash
rm -r apps/api-gateway/src/prisma/
```

**Step 7: Commit**

```bash
git add libs/backend/nestjs-prisma/ tsconfig.base.json
git add -u apps/api-gateway/src/prisma/
git commit -m "refactor: extract @roviq/nestjs-prisma lib from api-gateway"
```

---

### Task 5: Create `@roviq/casl` lib

Extract the CASL ability factory, `@CheckAbility` decorator, and seed-roles from api-gateway. Keep `AbilityGuard` and `CurrentAbility` decorator in the gateway (they use `GqlExecutionContext` and `AuthUser`).

**Files:**
- Create: `libs/backend/casl/project.json`
- Create: `libs/backend/casl/tsconfig.json`
- Create: `libs/backend/casl/tsconfig.lib.json`
- Create: `libs/backend/casl/vitest.config.ts`
- Create: `libs/backend/casl/src/index.ts`
- Move: `apps/api-gateway/src/casl/ability.factory.ts` → `libs/backend/casl/src/ability.factory.ts`
- Move: `apps/api-gateway/src/casl/check-ability.decorator.ts` → `libs/backend/casl/src/check-ability.decorator.ts`
- Move: `apps/api-gateway/src/casl/seed-roles.ts` → `libs/backend/casl/src/seed-roles.ts`
- Move: `apps/api-gateway/src/casl/__tests__/ability.factory.test.ts` → `libs/backend/casl/src/__tests__/ability.factory.test.ts`
- Keep in gateway: `apps/api-gateway/src/casl/ability.guard.ts`, `current-ability.decorator.ts`, `casl.module.ts`
- Modify: `tsconfig.base.json` — add `@roviq/casl` path alias

**Step 1: Create lib scaffolding**

`libs/backend/casl/project.json`:

```json
{
  "name": "casl",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/casl/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/casl",
        "main": "libs/backend/casl/src/index.ts",
        "tsConfig": "libs/backend/casl/tsconfig.lib.json",
        "assets": ["libs/backend/casl/*.md"]
      }
    }
  },
  "tags": []
}
```

`libs/backend/casl/tsconfig.json` and `tsconfig.lib.json` — same pattern as redis/nestjs-prisma.

`libs/backend/casl/vitest.config.ts` — copy from an existing backend lib (e.g., `nats-utils`) and adjust paths.

**Step 2: Move source files**

```bash
mkdir -p libs/backend/casl/src/__tests__
mv apps/api-gateway/src/casl/ability.factory.ts libs/backend/casl/src/
mv apps/api-gateway/src/casl/check-ability.decorator.ts libs/backend/casl/src/
mv apps/api-gateway/src/casl/seed-roles.ts libs/backend/casl/src/
mv apps/api-gateway/src/casl/__tests__/ability.factory.test.ts libs/backend/casl/src/__tests__/
```

**Step 3: Update imports in moved files**

`ability.factory.ts` currently imports:
- `from '../prisma/prisma.constants'` → change to `from '@roviq/nestjs-prisma'`
- `from '../redis/redis.constants'` → change to `from '@roviq/redis'`

```typescript
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import { REDIS_CLIENT } from '@roviq/redis';
```

The `@roviq/common-types` and `@roviq/prisma-client` imports stay the same.

`check-ability.decorator.ts` — no changes needed (only imports from `@roviq/common-types` and `@nestjs/common`).

`seed-roles.ts` — no changes needed (only imports from `@roviq/common-types` and `@roviq/prisma-client`).

**Step 4: Create barrel export**

`libs/backend/casl/src/index.ts`:

```typescript
export { AbilityFactory } from './ability.factory';
export { CHECK_ABILITY_KEY, CheckAbility, type AbilityCheck } from './check-ability.decorator';
export { seedDefaultRoles } from './seed-roles';
```

**Step 5: Add path alias to `tsconfig.base.json`**

```json
"@roviq/casl": ["libs/backend/casl/src/index.ts"]
```

**Step 6: Update gateway's remaining casl files**

`apps/api-gateway/src/casl/casl.module.ts` — update imports:

```typescript
import { AbilityFactory } from '@roviq/casl';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
import { AbilityGuard } from './ability.guard';
```

`apps/api-gateway/src/casl/ability.guard.ts` — update imports:

```typescript
import { AbilityFactory, type AbilityCheck, CHECK_ABILITY_KEY } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
```

Remove: `import type { AuthUser } from '../auth/jwt.strategy';`
Remove: `import { type AbilityCheck, CHECK_ABILITY_KEY } from './check-ability.decorator';`

`apps/api-gateway/src/casl/current-ability.decorator.ts` — no changes needed.

**Step 7: Delete moved files from gateway (keep guard, current-ability, module)**

```bash
rm apps/api-gateway/src/casl/ability.factory.ts
rm apps/api-gateway/src/casl/check-ability.decorator.ts
rm apps/api-gateway/src/casl/seed-roles.ts
rm -r apps/api-gateway/src/casl/__tests__/
```

**Step 8: Commit**

```bash
git add libs/backend/casl/ tsconfig.base.json
git add -u apps/api-gateway/src/casl/
git commit -m "refactor: extract @roviq/casl lib from api-gateway"
```

---

### Task 6: Rewire api-gateway imports

Update all gateway files that imported from relative `../prisma/`, `../redis/`, `../casl/` paths to use the new `@roviq/*` libs.

**Files:**
- Modify: `apps/api-gateway/src/app/app.module.ts`
- Modify: `apps/api-gateway/src/auth/auth.module.ts`
- Modify: `apps/api-gateway/src/auth/auth.resolver.ts`
- Modify: `apps/api-gateway/src/auth/auth.service.ts`

**Step 1: Update `app.module.ts`**

Replace:

```typescript
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
```

With:

```typescript
import { PrismaModule } from '@roviq/nestjs-prisma';
import { RedisModule } from '@roviq/redis';
import { CaslModule } from '../casl/casl.module';
```

Note: `CaslModule` still lives in the gateway (it's the NestJS module that wires the guard). Only the import path for Prisma and Redis changes.

**Step 2: Update `auth.module.ts`**

Replace:

```typescript
import { PlatformDatabaseModule } from '../prisma/platform-database.module';
```

With:

```typescript
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
```

**Step 3: Update `auth.resolver.ts`**

Replace:

```typescript
import { AbilityFactory } from '../casl/ability.factory';
import { ADMIN_PRISMA_CLIENT } from '../prisma/prisma.constants';
```

With:

```typescript
import { AbilityFactory } from '@roviq/casl';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
```

**Step 4: Update `auth.service.ts`**

Replace:

```typescript
import { ADMIN_PRISMA_CLIENT } from '../prisma/prisma.constants';
```

With:

```typescript
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
```

**Step 5: Run full verification**

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run e2e
```

Expected: all pass with zero errors.

**Step 6: Commit**

```bash
git add apps/api-gateway/src/
git commit -m "refactor: rewire api-gateway to use @roviq/casl, @roviq/nestjs-prisma, @roviq/redis libs"
```

---

### Task 7: Update docs and final cleanup

**Files:**
- Modify: `docs/architecture.md` — update the monorepo structure diagram
- Modify: `scripts/seed.ts` — if it imports `seedDefaultRoles` from gateway, update to `@roviq/casl`
- Verify: no remaining imports from deleted paths

**Step 1: Check for stale imports**

```bash
grep -r "from '\.\./prisma/" apps/api-gateway/src/ || echo "Clean"
grep -r "from '\.\./redis/" apps/api-gateway/src/ || echo "Clean"
grep -r "libs/prisma-client/src" tsconfig.base.json || echo "Clean"
grep -r "libs/auth/src" tsconfig.base.json || echo "Clean"
```

Expected: all print "Clean".

**Step 2: Update `docs/architecture.md`**

Update the monorepo structure section to reflect the new layout:

```
libs/
├── shared/
│   └── common-types/        # @roviq/common-types — CASL types, AuthUser
├── backend/
│   ├── prisma-client/       # @roviq/prisma-client — Prisma schema + RLS extensions
│   ├── nestjs-prisma/       # @roviq/nestjs-prisma — NestJS DI modules for Prisma
│   ├── casl/                # @roviq/casl — ability factory, decorators, role seeding
│   ├── redis/               # @roviq/redis — NestJS DI module for ioredis
│   └── nats-utils/          # @roviq/nats-utils — NATS JetStream wrappers
└── frontend/
    ├── auth/                # @roviq/auth — React auth context, login, JWT decode
    ├── graphql/             # @roviq/graphql — Apollo Client setup
    ├── i18n/                # @roviq/i18n — next-intl config, routing, formatting
    └── ui/                  # @roviq/ui — shadcn/ui components, layout
```

**Step 3: Check `scripts/seed.ts`**

If it imports `seedDefaultRoles`, update the import to `from '@roviq/casl'`.

**Step 4: Run full verification**

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run e2e
```

**Step 5: Commit**

```bash
git add docs/architecture.md scripts/seed.ts
git commit -m "docs: update architecture diagram for libs reorganization"
```
