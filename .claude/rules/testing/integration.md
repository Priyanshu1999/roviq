---
description: Rules for writing and modifying integration tests (real DB, in-process NestJS)
globs:
  - "**/*.integration.spec.ts"
---

# Integration Test Rules

## What Is an Integration Test in Roviq

A test that boots a NestJS module **in-process** via `Test.createTestingModule()` with a **real PostgreSQL database** (5-role RLS setup) and exercises the resolver → service → repository → `withTenant()` → `SET LOCAL ROLE` → RLS pipeline. HTTP requests go through **supertest** against the in-process app.

This is the layer that catches:
- `withTenant()` / `withReseller()` / `withAdmin()` wrapper bugs
- Scope guard wiring (`@PlatformScope`, `@ResellerScope`, `@InstituteScope`)
- CASL `@CheckAbility` decorator enforcement against real DB rows
- `accessibleBy()` Drizzle query scoping
- Audit interceptor → NATS publish (with mocked or real NATS)
- Cross-tenant RLS isolation through the actual application stack
- JWT validation through the real auth pipeline

## Framework & Runner

- **Vitest** with `--project integration` (defined in `vitest.workspace.ts`).
- File naming: `__tests__/{name}.integration.spec.ts` colocated next to the source.
- Runs with `pool: 'forks'` for process isolation — each test file gets its own process.
- `pnpm test:int` to run all integration tests.

## Prerequisites

Integration tests require a running test database with the full 5-role setup:
```bash
pnpm db:reset --test   # runs migrations + custom SQL (roles, GRANTs, RLS) + seed
```

`db:push` is NOT sufficient — it skips `CREATE ROLE`, `GRANT`, `FORCE ROW LEVEL SECURITY`, and custom SQL migrations. Never use `db:push` for test database setup.

## Using `@roviq/testing` Library

All integration tests use utilities from `@roviq/testing`:

```typescript
import {
  createIntegrationApp,
  createPlatformToken,
  createResellerToken,
  createInstituteToken,
  createTestInstitute,
  gqlRequest,
  createMock,
} from '@roviq/testing';
```

### Booting the App

```typescript
describe('Student Resolver (integration)', () => {
  let app: INestApplication;
  let gql: ReturnType<typeof gqlRequest>;

  beforeAll(async () => {
    const result = await createIntegrationApp([InstituteModule]);
    app = result.app;
    gql = result.gql;
  });

  afterAll(async () => {
    await app.close();
  });
});
```

`createIntegrationApp()` boots `Test.createTestingModule()` with:
- Real PostgreSQL via `DATABASE_URL_TEST`
- Mocked NATS (default) or real NATS via `createIntegrationAppWithNats()`
- Mocked Redis, Temporal
- Real JWT validation, scope guards, CASL, audit interceptor
- supertest bound to the in-process HTTP server

### Making GraphQL Requests

```typescript
it('should return students for authenticated institute admin', async () => {
  const token = createInstituteToken(userId, tenantId);
  const { data, errors } = await gql(
    `query { students(first: 10) { edges { node { id name } } } }`,
    {},
    token,
  );
  expect(errors).toBeUndefined();
  expect(data.students.edges.length).toBeGreaterThan(0);
});
```

### Cross-Scope Rejection (CRITICAL — every scope guard must have this)

```typescript
it('should reject reseller token on @PlatformScope resolver', async () => {
  const resellerToken = createResellerToken(userId, resellerId);
  const { errors } = await gql(
    `query { adminInstitutes(first: 10) { edges { node { id } } } }`,
    {},
    resellerToken,
  );
  expect(errors).toBeDefined();
  expect(errors[0].extensions.code).toBe('FORBIDDEN');
});

it('should reject institute token on @PlatformScope resolver', async () => {
  const instituteToken = createInstituteToken(userId, tenantId);
  const { errors } = await gql(
    `query { adminInstitutes(first: 10) { edges { node { id } } } }`,
    {},
    instituteToken,
  );
  expect(errors).toBeDefined();
  expect(errors[0].extensions.code).toBe('FORBIDDEN');
});
```

**Every `@PlatformScope`, `@ResellerScope`, and `@InstituteScope` resolver MUST have cross-scope rejection tests.** This is the G2 gap from the audit — zero tests existed before.

### Cross-Tenant RLS Isolation

```typescript
it('should not return tenant B students when scoped to tenant A', async () => {
  const tenantA = await createTestInstitute(pool);
  const tenantB = await createTestInstitute(pool);

  // Create a student in tenant B
  // (via direct DB insert using withTenant for setup)

  // Query as tenant A
  const tokenA = createInstituteToken(tenantA.userId, tenantA.tenantId);
  const { data } = await gql(`query { students(first: 100) { edges { node { id } } } }`, {}, tokenA);

  // Tenant A should see 0 students from tenant B
  const ids = data.students.edges.map((e: any) => e.node.id);
  expect(ids).not.toContain(tenantBStudentId);
});
```

### Audit Pipeline (end-to-end with real NATS)

```typescript
describe('Audit pipeline', () => {
  let app: INestApplication;
  let gql: ReturnType<typeof gqlRequest>;
  let pool: Pool;

  beforeAll(async () => {
    // Use createIntegrationAppWithNats for real NATS
    const result = await createIntegrationAppWithNats([InstituteModule, AuditModule]);
    app = result.app;
    gql = result.gql;
    pool = result.pool;
  });

  it('should write audit log via NATS consumer after mutation', async () => {
    const token = createInstituteToken(userId, tenantId);
    await gql(`mutation { updateStudent(input: { id: "${studentId}", name: "Rajesh" }) { id } }`, {}, token);

    // Poll audit_logs — consumer processes asynchronously
    const rows = await waitForAuditLog(pool, tenantId, 'updateStudent', 5000);
    expect(rows).toHaveLength(1);
    expect(rows[0].action_type).toBe('UPDATE');
    expect(rows[0].entity_type).toBe('Student');
  });
});
```

```typescript
async function waitForCondition(fn: () => Promise<boolean>, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Condition not met within timeout');
}
```

## Test Data Setup

- **Create fresh test data per suite** using `createTestInstitute()`, `createTestUser()`, `createMembership()` from `@roviq/testing`. These create real DB rows with random UUIDs — zero collision with seed data.
- **Can READ seed data** — look up system role IDs (`SEED.ROLE_INSTITUTE_ADMIN.id`) for membership creation.
- **Never INSERT into seed entities** — no creating memberships for seeded users (this was Issue 1 from the testing report).

## Cleanup

- **Transaction rollback** for most tests: wrap in `BEGIN` / `ROLLBACK`.
- For tests that need committed data (RLS policy tests, triggers): use `afterEach` with targeted `DELETE` in reverse FK order.
- **Never `TRUNCATE`** — too aggressive, breaks concurrent test runs.
- `app.close()` in `afterAll` to release connection pool.

## What MUST Be Integration Tested (minimum per module)

For every new module/resolver, agents must write at minimum:
1. **Happy path** — authenticated request returns correct data through real DB
2. **Cross-scope rejection** — wrong scope token returns FORBIDDEN
3. **Cross-tenant isolation** — tenant A cannot see tenant B data
4. **Error path** — invalid input returns validation error through real pipeline

## Forbidden in Integration Tests

- Mocking the database — that's the whole point of this layer. If you mock Drizzle/PG, it's a unit test. Name it `*.spec.ts`.
- `vi.useFakeTimers()` — integration tests run against real async systems
- Testing pure logic that belongs in unit tests (fee math, string transforms)
- Hardcoded UUIDs that could collide — use `randomUUID()` or `createTestInstitute()`
- Skipping cleanup — leaked test data causes flaky tests in CI
- `any` type casts to bypass type errors on test data
- Naming a file `*.integration.spec.ts` when it mocks the database (the upi-p2p anti-pattern)
