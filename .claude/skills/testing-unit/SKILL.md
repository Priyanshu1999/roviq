---
name: testing-unit
description: Use when writing, modifying, or reviewing unit tests (*.spec.ts, *.spec.tsx) — covers Vitest setup, mocking with createMock, test factories, assertions, CASL ability testing, monetary BigInt patterns, and all banned patterns
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

Use `createMock<T>()` from `@golevelup/ts-vitest`. Import it from `@roviq/testing` (light entry — unit tests) or `@roviq/testing/integration` (heavy entry — integration tests). The split keeps unit tests from pulling in supertest, Drizzle, and the NestJS testing module.

```typescript
// Unit test
import { createMock } from '@roviq/testing';

// Integration test
import { createMock } from '@roviq/testing/integration';

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
- Non-null assertions (`!`) in test files — narrow with `assert(value)` from `node:assert` instead

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

---

# Unit Test Rules

## Framework & Runner

- **Vitest** exclusively. Never Jest.
- Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`.
- File naming: `__tests__/{name}.spec.ts` colocated next to the source file.
- Component tests: `__tests__/{name}.spec.tsx` (see `testing-frontend` rules).

## What Qualifies as a Unit Test

Unit tests cover **pure logic in isolation** — no database, no NATS, no HTTP, no filesystem, no Redis. If it needs any of those, it belongs in an integration test (`*.integration.spec.ts`).

Examples of unit-testable code in Roviq:
- Diff computation logic (audit system)
- Sensitive field masking (`@AuditMask()` processing)
- Action type extraction from GraphQL mutation names
- CASL ability builders and permission checks (in-memory)
- Fee calculation functions (paise arithmetic, FIFO allocation)
- Zod schema validation
- Date/academic-year utility functions
- Value objects, DTOs, input transformers, mappers

## Mocking with `createMock<T>()`

Use `createMock<T>()` from `@roviq/testing` (re-exports `@golevelup/ts-vitest`) for all dependency mocks:

```typescript
import { createMock } from '@roviq/testing';
import { Test, TestingModule } from '@nestjs/testing';

const module = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: ConfigService, useValue: createMock<ConfigService>({
      get: vi.fn((key) => ({ JWT_SECRET: 'test-secret' }[key])),
    })},
    { provide: RedisService, useValue: createMock<RedisService>() },
    { provide: NatsClient, useValue: createMock<NatsClient>() },
  ],
}).compile();
```

For services with simple dependencies, raw class instantiation is also acceptable:

```typescript
const service = new FeeCalculator();
const result = service.allocateFIFO({ paymentPaise: 150000n, invoices });
```

### Banned mocking patterns

- `as never` on constructor args or mock objects
- `as unknown as SomeType`
- `as any`
- `Reflect.construct(Class, [mock1, mock2])` — replaced by `createMock<T>()`
- `vi.mock()` on the file being tested
- Mocking the function/class under test (split the logic instead)

## Test Structure

- One `describe` block per function or method. Nest `describe` for complex branching.
- `it('should ...')` — describe **expected behavior**, not implementation.
- AAA pattern: Arrange → Act → Assert. Separate with blank lines.
- Each `it` tests **one behavior**. Multiple `expect` calls are fine for different facets of the same behavior.
- `vi.clearAllMocks()` is handled by `restoreMocks: true` in vitest config — do not add manually unless overriding per-test.

## Assertions

- `expect(result).toEqual(expected)` for objects (deep equality).
- `expect(result).toBe(expected)` for primitives only.
- `expect(() => fn()).toThrow(SpecificError)` or `await expect(fn()).rejects.toThrow()` for errors.
- `expect(mock).toHaveBeenCalledWith(expect.objectContaining({ ... }))` for mock calls.
- Never `expect(result).toBeTruthy()` when a specific value is known.

## Roviq-Specific Patterns

### Tenant Context
Pass `tenantId` explicitly — never rely on ambient context:
```typescript
it('should compute fee for tenant', () => {
  const result = computeFee({ tenantId: TENANT_A, amount: 50000 });
  expect(result.paise).toBe(5000000);
});
```

### CASL Abilities
Test ability builders as pure functions:
```typescript
it('should allow institute admin to read own audit logs', () => {
  const ability = buildAbilityFor({ role: 'INSTITUTE_ADMIN', tenantId: TENANT_A });
  expect(ability.can('read', subject('AuditLog', { tenantId: TENANT_A }))).toBe(true);
  expect(ability.can('read', subject('AuditLog', { tenantId: TENANT_B }))).toBe(false);
});
```

### Monetary Values
All money is `BIGINT` paise. Test with BigInt literals:
```typescript
it('should allocate payment using FIFO', () => {
  const result = allocateFIFO({ paymentPaise: 150000n, invoices });
  expect(result[0].allocatedPaise).toBe(100000n);
});
```

### Audit Helpers
The `audit-helpers.spec.ts` (597 LOC, 70+ cases) is the gold standard in this repo. Follow its patterns: pure function input → assert output, no mocks needed.

## Forbidden in Unit Tests

- Real database connections (`PrismaClient`, `pg.Pool`, Drizzle with real URL)
- `await app.listen()` or `await app.init()` — that's integration testing
- Real NATS, Redis, or Temporal connections
- `fetch()` or HTTP calls
- `setTimeout`/`setInterval` — use `vi.useFakeTimers()` if testing time-dependent logic
- Test data in external JSON files — inline small fixtures, use factories for complex ones
- `console.log` — use `vi.spyOn(console, 'warn')` if testing warning behavior
- `any` type — type your mocks and fixtures properly
- Snapshot tests (`toMatchSnapshot()`)
