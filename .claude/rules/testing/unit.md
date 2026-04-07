---
description: Rules for writing and modifying unit tests
globs:
  - "**/__tests__/*.spec.ts"
  - "**/__tests__/*.spec.tsx"
  - "!**/*.integration.spec.ts"
  - "!**/*.api-e2e.spec.ts"
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
