# `@roviq/testing`

Shared test infrastructure for the Roviq monorepo. Two entry points:

| Subpath | Imports | Use from |
| --- | --- | --- |
| `@roviq/testing` | `createMock`, JWT token factories | **unit** tests — zero NestJS / pg / env mutation |
| `@roviq/testing/integration` | `createIntegrationApp`, `gqlRequest`, data factories, polling, token factories, `createMock` | **integration** tests — boots NestJS in-process |

The split exists to keep unit tests fast: importing the lightweight barrel pulls in nothing more than `jsonwebtoken` and `@golevelup/ts-vitest`. The heavy barrel pulls in supertest, Drizzle, `@node-rs/argon2`, and the NestJS testing module.

All test files should import test utilities from this lib — never directly from `@golevelup/ts-vitest`.

## Prerequisites

Integration tests require the five-role test database. Run once before iterating:

```bash
pnpm db:reset --test
```

The integration entry point auto-fills missing env vars (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `NATS_URL`, `WEBAUTHN_*`, `ALLOWED_ORIGINS`, `NODE_ENV=test`) from `setupTestEnv()` inside `createIntegrationApp()` — so a test runner without a `.env` boots cleanly. Set `DATABASE_URL_TEST` (or `DATABASE_URL`) to point at the test database if you need a non-default URL.

The integration project's vitest config also needs `unplugin-swc` (already wired in `vitest.config.ts`) so SWC emits decorator metadata. Without that, NestJS DI cannot resolve constructor parameters by type, and you'll see errors like `config.getOrThrow is not a function` when `JwtStrategy` boots.

## Quick start (unit test)

```typescript
import { createMock } from '@roviq/testing';
import type { ConfigService } from '@nestjs/config';

const config = createMock<ConfigService>({
  get: vi.fn().mockReturnValue('test-value'),
});
```

## Quick start (integration test)

```typescript
import {
  createIntegrationApp,
  createPlatformToken,
  createTestInstitute,
  cleanupTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';

describe('Section resolver (integration)', () => {
  let result: IntegrationAppResult;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
  });
  afterAll(() => result.close());

  it('lists institutes via the platform admin pipeline', async () => {
    const tenant = await createTestInstitute(result.db);
    try {
      const token = createPlatformToken({
        sub: '00000000-0000-4000-a000-000000000201',
        membershipId: '00000000-0000-4000-a000-000000000401',
        roleId: '00000000-0000-4000-a000-000000000301',
      });
      const { data, errors } = await gqlRequest<{
        adminListInstitutes: { edges: Array<{ node: { id: string; slug: string } }> };
      }>(result.httpServer, {
        query: `query { adminListInstitutes { edges { node { id slug } } } }`,
        token,
      });
      expect(errors).toBeUndefined();
      expect(data?.adminListInstitutes.edges).toBeInstanceOf(Array);
    } finally {
      await cleanupTestInstitute(result.db, tenant);
    }
  });
});
```

## API reference (integration)

### `createIntegrationApp({ modules, overrides?, useRealNats? })`

Boots NestJS in-process with a real PostgreSQL connection via `DRIZZLE_DB`. Redis and NATS are mocked by default. Returns `{ app, module, httpServer, db, close }`.

The app is wired identically to production: same global prefix (`/api`), same `ValidationPipe` options, same scope guards, same audit interceptor. The Nest logger is disabled (`logger: false`) so test runs are quiet.

`db` is the same Drizzle instance the app uses — pass it directly to factories like `createTestInstitute(db)` so tests share the app's pg pool instead of opening a second one.

`overrides` accepts `{ provide: token, useValue: value }` entries with the proper `InjectionToken` type — typos in the token are caught at compile time.

### `createIntegrationAppWithNats(options)`

Variant that boots against the real NATS server at `NATS_URL`. Use only for tests that exercise the full audit pipeline (mutation → publish → consumer → DB).

### Token factories

All four match the JWT shape produced by the corresponding login mutation, so the api-gateway's `JwtStrategy` validates them without any special-casing:

- `createInstituteToken({ sub, tenantId, membershipId, roleId })`
- `createPlatformToken({ sub, membershipId, roleId })`
- `createResellerToken({ sub, resellerId, membershipId, roleId })`
- `createImpersonationToken({ sub, tenantId, membershipId, roleId, impersonatorId, impersonationSessionId })`

For **platform** scope, CASL grants `manage:all` without any DB lookup, so the `sub`/`membershipId`/`roleId` UUIDs do not need to exist in the database. For **institute** and **reseller** scopes, CASL queries the membership row, so those IDs must reference real rows (use `createTestInstitute` / `createTestReseller`).

### `gqlRequest(httpServer, { query, variables?, token? })`

Sends a GraphQL request via supertest to `/api/graphql`. Returns `{ data, errors }`. GraphQL resolver errors come back as HTTP 200 with `errors` in the body — those flow through normally. Transport-layer failures (HTTP ≥ 400) **throw** so tests don't silently pass with `data === undefined`.

### `waitForCondition(fn, options?)` and `waitForAuditLog(pool, query)`

Polling helpers for asserting async side effects. `waitForCondition` retries a callback until it returns true or times out. `waitForAuditLog` holds a single `roviq_admin` connection across all poll iterations and queries `audit_logs` for matching rows; the connection is rolled back at the end so the helper leaves no trace.

### `createTestInstitute(db, options?)`

Inserts a fresh institute + admin user + institute-scoped role + membership inside a single `withAdmin()` transaction, returning the IDs needed to mint an `institute`-scoped token. UUIDs come from Postgres `uuidv7()` defaults, so they cannot collide with seed data. The membership is created with `abilities: [{ action: 'manage', subject: 'all' }]` so CASL grants the test admin every permission.

```typescript
const tenant = await createTestInstitute(result.db, {
  password: 'secret123', // optional — argon2-hashed for tests that exercise instituteLogin
});
const token = createInstituteToken({
  sub: tenant.userId,
  tenantId: tenant.tenantId,
  membershipId: tenant.membershipId,
  roleId: tenant.roleId,
});
// ...
await cleanupTestInstitute(result.db, tenant);
```

**Limitation:** the factory does NOT create academic_years, branding, configs, or identifiers. Tests that exercise resolvers depending on those need to insert them explicitly. This is intentional — see "What this lib does NOT do" below.

### `createTestReseller(db)`

Same idea, for reseller-scoped tests. Pair with `cleanupTestReseller(db, reseller)`.

### `createMock<T>()`

Re-exported from `@golevelup/ts-vitest`. Available from both subpaths.

## Conventions

- **One app per file.** `createIntegrationApp` in `beforeAll`, `result.close()` in `afterAll`. Each app boot takes ~1–3 seconds; per-test boots are unnecessarily slow.
- **Use `result.db` from the integration app.** Don't open a second `pg.Pool` for factories — they accept the same Drizzle instance.
- **Cross-scope rejection coverage.** Every `@PlatformScope`, `@ResellerScope`, and `@InstituteScope` resolver should have at least one integration test asserting wrong-scope tokens return `FORBIDDEN`.
- **Cross-tenant isolation coverage.** For tenant-scoped data, write at least one test that creates two institutes via `createTestInstitute` and verifies tenant A cannot read tenant B's data through the resolver.
- **Never mock the database.** The whole point of integration tests is to exercise the real `withTenant()` / RLS pipeline. If a test mocks Drizzle, it belongs in a `*.spec.ts` unit test instead.

## What this lib does NOT do

- **Mock Temporal.** Tests that hit resolvers enqueueing Temporal workflows (TC issuance, bulk imports, audit partition management) will try to connect to a real Temporal server. Mock the client manually via `overrides`.
- **Provide a fully-featured Redis fake.** The default Redis mock only stubs `get`/`set`/`del`. Tests that exercise rate limiting, ws-tickets, or pipeline ops need to override `REDIS_CLIENT` themselves.
- **Create academic years, branding, configs, identifiers, or any non-essential institute children.** `createTestInstitute` is intentionally minimal so unrelated tests don't pay for setup they don't use. Extend the factory only when a real test needs more.
- **Clean up the audit_logs partition.** If a test inserts audit rows manually, it must delete them in `afterAll`.
