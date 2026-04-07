---
description: Shared testing conventions across all test types (unit, integration, E2E API, E2E UI, component)
globs:
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/*.integration.spec.ts"
  - "**/*.api-e2e.spec.ts"
  - "**/*.e2e.spec.ts"
  - "**/*.hurl"
  - "**/test/**"
  - "**/__tests__/**"
---

# Shared Testing Conventions

## Terminology

Always "institute" — never "school" — in test descriptions, fixture data, and comments.

## Test File Classification

| Suffix | Type | Runner | Runs Against |
|---|---|---|---|
| `*.spec.ts` | Unit | Vitest (`pnpm test`) | In-memory only |
| `*.spec.tsx` | Component (RTL) | Vitest (`pnpm test`) | JSDOM/happy-dom |
| `*.integration.spec.ts` | Integration | Vitest (`pnpm test:int`) | Real PG (5-role setup), in-process NestJS via `Test.createTestingModule()` + supertest |
| `*.api-e2e.spec.ts` | E2E API | Vitest (`pnpm test:e2e:api`) | Full running stack (Tilt or Docker `--profile e2e`) |
| `*.hurl` | E2E API workflows | Hurl (`pnpm test:e2e:hurl`) | Full running Docker stack (`--profile e2e`). Being migrated to Vitest domain-by-domain. |
| `*.e2e.spec.ts` | E2E UI | Playwright (`pnpm test:e2e:ui`) | Full running stack + browser |

If a file doesn't match these patterns, the agent must ask which type before writing tests.

## File Location

| Type | Location | Example |
|---|---|---|
| Unit | `__tests__/` colocated next to source | `apps/api-gateway/src/auth/__tests__/auth.service.spec.ts` |
| Component | `__tests__/` colocated next to component | `libs/frontend/ui/src/components/__tests__/Field.spec.tsx` |
| Integration | `__tests__/` colocated next to source | `apps/api-gateway/src/auth/__tests__/auth.integration.spec.ts` |
| E2E API (Vitest) | `e2e/api-gateway-e2e/src/` | `e2e/api-gateway-e2e/src/auth.api-e2e.spec.ts` |
| E2E API (Hurl) | `e2e/api-gateway-e2e/hurl/{domain}/` | `e2e/api-gateway-e2e/hurl/student/01-create-student.hurl` |
| E2E UI | `e2e/web-{admin,institute,reseller}-e2e/src/` | `e2e/web-admin-e2e/src/login.e2e.spec.ts` |

## Mocking Library

Use `createMock<T>()` from `@golevelup/ts-vitest` (re-exported via `@roviq/testing`) for typed auto-mocks.

```typescript
import { createMock } from '@roviq/testing';

const mockConfig = createMock<ConfigService>({
  get: vi.fn((key) => configMap[key]),
});
```

**Banned patterns:**
- `as never` / `as unknown` / `as any` on mock objects
- `Reflect.construct(Class, [mock1, mock2])`
- `@suites/unit` / `TestBed.solitary()`

## Test Factories

Use factory functions in `@roviq/testing` or local `__tests__/factories/`:

```typescript
import { buildStudent, createTestInstitute } from '@roviq/testing';
const student = buildStudent({ name: 'Rajesh Kumar' });
```

Rules:
- Every factory produces a valid entity with zero arguments.
- Use `overrides` parameter for test-specific variations.
- Monetary fields use `BigInt` paise: `feePaise: 500000n` (₹5,000).
- Factories never hit the database.

## Seed Data Contract

| Layer | Rule |
|---|---|
| Unit | None. All data from factories. |
| Integration | Never INSERT into seed entities. Can READ seed role IDs. Use `createTestInstitute()` / `createTestUser()` per suite. |
| E2E API / UI | Import `SEED` from `@roviq/testing/seed-ids`. Use `SEED.INSTITUTE_1.id` and `SEED.INSTITUTE_1.name`. Never hardcode seed entity names. |

## Vitest Configuration

Root `vitest.workspace.ts` defines three projects: `unit`, `integration`, `e2e-api`. Per-project configs extend `vitest.shared.ts`. Path aliases resolved via `vite-tsconfig-paths` from `tsconfig.base.json` — never hardcode `@roviq/*` aliases in individual vitest configs.

## pnpm Scripts (Agents Use These, Never Raw Commands)

| Script | What runs | Requires |
|---|---|---|
| `pnpm test` | Unit + component tests | Node.js only |
| `pnpm test:int` | Integration tests (real DB) | Local PG with `pnpm db:reset --test` |
| `pnpm test:e2e:api` | Vitest E2E API | Running stack (Tilt or Docker) |
| `pnpm test:e2e:hurl` | Hurl domain workflows | Docker `--profile e2e` |
| `pnpm test:e2e:ui` | Playwright | Running stack + browsers |
| `pnpm test:all` | All sequentially | Full stack |

## Compose Profiles

| Profile | API Port | PG Port | Starts | Use for |
|---|---|---|---|---|
| `dev` | 3000 | 5432 | Infra only (PG, Redis, NATS) | Local dev, Tilt manages apps |
| `e2e` | 3004 | 5433 | Full stack + Novu | Local E2E, `pnpm test:e2e:hurl` |
| `ci` | 3004 | 5433 | Same as `e2e` | GitHub Actions |

## What NOT to Test

Auto-generated code, NestJS decorator wiring, third-party library internals, getter/setter with no logic, config/env loading.

## Banned

- Snapshot tests (`toMatchSnapshot()`, `toMatchInlineSnapshot()`)
- `setTimeout` / manual delays in tests (use `vi.useFakeTimers()` or polling with timeout)
- Hardcoded seed entity names in Playwright (use `SEED` import)
- `console.log` in test files
- `any` type in test files

## CI Matrix (all blocking)

| Job | Time budget |
|---|---|
| Unit + component | < 60s |
| Integration | < 5 min |
| E2E API (Vitest + Hurl) | < 5 min |
| E2E UI (Playwright) | < 10 min |
| Typecheck + codegen | < 2 min |

## Coverage Thresholds (CI-blocking)

- `libs/shared/domain/` — 80%
- `libs/backend/casl/` — 80%
- `libs/frontend/ui/` — 60%
