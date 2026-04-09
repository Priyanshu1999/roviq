---
name: testing-e2e
description: Use when writing, modifying, or reviewing E2E API tests (*.api-e2e.spec.ts, *.hurl) — covers Vitest E2E against running stack, GraphQL gql() helper, auth helpers for 3 scopes, subscription testing, webhook simulation, Hurl migration, and seed data contracts
---

# E2E API Test Rules

## Two Tools, Different Purposes

| Tool | Purpose | Migration status |
|---|---|---|
| **Vitest** (`*.api-e2e.spec.ts`) | Auth, audit, RLS isolation, security invariants, subscriptions, cross-cutting concerns | Primary — all new E2E API tests go here |
| **Hurl** (`*.hurl`) | Domain CRUD workflows (student lifecycle, billing flows, certificate state machine) | Migrating to Vitest domain-by-domain. New domain tests in Vitest. |

Both test against a **fully running external stack** — nothing is in-process, nothing is mocked. The test is a pure external client.

## Vitest E2E API Tests

### File Location & Naming

- Location: `e2e/api-gateway-e2e/src/`
- Naming: `{domain}.api-e2e.spec.ts`
- Helpers: `e2e/api-gateway-e2e/src/helpers/`
- One file per domain or cross-cutting concern.

### Making GraphQL Requests

Use the existing `gql()` helper (raw `fetch`, not supertest — E2E hits a real running server):

```typescript
import { gql } from './helpers/gql-client';
import { loginAsInstituteAdmin, loginAsPlatformAdmin, loginAsReseller } from './helpers/auth';

it('should create student via authenticated mutation', async () => {
  const { accessToken } = await loginAsInstituteAdmin();
  const { data, errors } = await gql(
    `mutation CreateStudent($input: CreateStudentInput!) {
      createStudent(input: $input) { id name }
    }`,
    { input: { name: 'Rajesh Kumar', enrollmentNumber: 'ENR-001' } },
    accessToken,
  );
  expect(errors).toBeUndefined();
  expect(data.createStudent.name).toBe('Rajesh Kumar');
});
```

### Auth Helpers (3 scopes)

```typescript
loginAsInstituteAdmin(instituteIndex?)  // institute-scoped token (2-step: login → selectInstitute)
loginAsPlatformAdmin()                  // platform-scoped token (calls adminLogin)
loginAsReseller()                       // reseller-scoped token (calls resellerLogin)
loginAsTeacher()                        // institute-scoped token (single-institute user)
loginAsStudent()                        // institute-scoped token (single-institute user)
```

All credentials come from `E2E_USERS` in `e2e-constants.ts` — never hardcode credentials inline. All use GraphQL `variables` object for credential passing — never string interpolation (query injection risk).

### Testing Subscriptions

Use `subscribeOnce()` from `helpers/ws-client.ts`:

```typescript
import { subscribeOnce } from './helpers/ws-client';

it('should receive sectionStrengthChanged event after enrollment', async () => {
  const { accessToken } = await loginAsInstituteAdmin();

  // Subscribe BEFORE triggering the mutation
  const eventPromise = subscribeOnce(
    `subscription { sectionStrengthChanged(sectionId: "${sectionId}") { sectionId newStrength } }`,
    accessToken,
  );

  // Trigger the mutation that causes the event
  await gql(`mutation { enrollStudent(input: { studentId: "${studentId}", sectionId: "${sectionId}" }) { id } }`,
    {}, accessToken);

  // Assert the subscription event
  const event = await eventPromise; // 5s timeout built into subscribeOnce
  expect(event.data.sectionStrengthChanged.newStrength).toBe(previousStrength + 1);
});
```

Rules for subscription tests:

- Set up the subscription listener **before** triggering the mutation.
- `subscribeOnce()` handles ws-ticket exchange internally.
- 5-second timeout is built in — if the event doesn't arrive, the test fails with a clear timeout error.
- Test all three scope tokens for scope-filtered subscriptions (platform admin gets all events, reseller gets their institutes' events, institute user gets only their own).

### Testing Webhook Simulation (Payments)

```typescript
import { simulatePaymentWebhook } from './helpers/webhook';

it('should process payment via simulated webhook', async () => {
  // ... create plan, assign, generate invoice first ...
  await simulatePaymentWebhook({
    invoiceId,
    amount: 99900,
    status: 'captured',
    gatewayPaymentId: 'pay_test_123',
  });

  // Verify invoice status updated
  const { data } = await gql(`query { invoice(id: "${invoiceId}") { status } }`, {}, resellerToken);
  expect(data.invoice.status).toBe('PAID');
});
```

No external payment gateway needed. The helper crafts a signed payload and POSTs directly to the webhook controller endpoint.

### Seed Data

Import from `@roviq/testing/seed-ids`:

```typescript
import { SEED } from '@roviq/testing/seed-ids';

// Use SEED.INSTITUTE_1.id, SEED.ADMIN_USER.id, etc.
// Use SEED.INSTITUTE_1.name for assertion (not for finding elements)
```

E2E tests reference seed entities by their fixed UUIDs. These IDs are committed in the seed file and stable across `db:reset`.

### Flows to Cover Per Domain

When migrating a Hurl domain to Vitest, each domain needs at minimum:

1. **CRUD happy path** — create, read, update, soft-delete
2. **Auth rejection** — unauthenticated request gets `UNAUTHENTICATED`
3. **Scope rejection** — wrong-scope token gets `FORBIDDEN`
4. **Tenant isolation** — tenant A data invisible to tenant B
5. **Error paths** — duplicate, not found, validation error
6. **Lifecycle/state machine** (if applicable) — status transitions with valid and invalid transitions

### Running

```bash
# Against dev Tilt (fast iteration, uses dev DB — may leave dirty data)
pnpm test:e2e:api

# Against isolated Docker stack (clean, reproducible)
docker compose --profile e2e up -d
pnpm test:e2e:api
docker compose --profile e2e down
```

## Hurl Tests (Migrating)

### Current State

77 active `.hurl` files across 13 domains. Being migrated to Vitest domain-by-domain.

### Migration Priority

When an agent builds a new feature in a domain, they migrate that domain's Hurl files to Vitest as part of the same issue. Order:

1. student/ (10 files) — highest value
2. institute/ (15 files) — covers all 3 scopes
3. billing/ (14 files) — plan + subscription + invoice
4. Remaining domains as touched

### Writing New Hurl Tests (until migration complete)

If adding a test for an unmigrated domain, write it in Hurl to keep the domain's tests together:

```hurl
# e2e/api-gateway-e2e/hurl/student/11-new-feature.hurl

POST {{base_url}}/graphql
Authorization: Bearer {{inst_token}}
Content-Type: application/json
{
  "query": "mutation { newFeature(input: { ... }) { id } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.newFeature.id" exists
```

Variables come from `vars.e2e.env` (base_url, tokens from `auth-setup.sh`).

### After Migration

When all `.hurl` files in a domain are migrated to Vitest:

1. Delete the `.hurl` files for that domain
2. Verify the Vitest equivalents pass in CI
3. Once ALL domains are migrated: remove Hurl runner from compose, delete `auth-setup.sh`, delete `vars.e2e.env`

## Forbidden in E2E Tests

- Mocking any service — everything is real
- Direct database queries to set up state (use GraphQL mutations or seed data). Exception: `waitForAuditLog()` polls the DB for async consumer assertions.
- Testing internal implementation details (which NATS subject was published, what SQL ran)
- `subscriptions-transport-ws` — use `graphql-ws` v6 exclusively
- Hardcoded credentials outside of `E2E_USERS`
- String interpolation for credentials in GraphQL queries — use `variables` object
- `sleep()` or fixed delays — use polling with timeout
- `.skip()` without a linked Linear issue comment explaining why
