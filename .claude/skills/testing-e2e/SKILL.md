---
name: testing-e2e
description: Use when writing, modifying, or reviewing E2E API tests (*.api-e2e.spec.ts) — covers Vitest E2E against a running api-gateway + Temporal + Novu stack, GraphQL gql() helper, the 7 auth helpers, seed contract, subscription patterns with graphql-ws ticket exchange, payment webhook simulation, Novu notification assertions, and the forbidden patterns uncovered by the Hurl migration.
---

# E2E API Test Rules

## What this skill covers

Vitest `*.api-e2e.spec.ts` tests that run against a **fully running external stack** — api-gateway, postgres, redis, nats, temporal, notification-service, novu-api, minio. Nothing is in-process, nothing is mocked. The test is a pure external HTTP / graphql-ws client.

Hurl (`*.hurl`) is **dead**. Do not add new `.hurl` files. Any leftover files in `e2e/api-gateway-e2e/hurl/` are pending deletion as their domains finish migration — they are not an extension point.

## File location & naming

- Specs: `e2e/api-gateway-e2e/src/{domain}.api-e2e.spec.ts` — one file per domain or cross-cutting concern.
- Helpers: `e2e/api-gateway-e2e/src/helpers/` (`auth.ts`, `gql-client.ts`, `ws-client.ts`, `webhook.ts`, `novu.ts`).
- Shared fixtures: `e2e/shared/` — cross-cutting assets reused by Vitest E2E and Playwright.

## Prerequisites

```bash
pnpm e2e:up            # brings up postgres/redis/nats first, then the rest with --build --wait
pnpm test:e2e:api      # runs the Vitest E2E project against the up stack
```

`pnpm e2e:up` is the only sanctioned way to bring up the Docker stack — it runs `docker compose -p roviq-e2e -f docker/compose.e2e.yaml up -d --wait` after a staged startup of the infra layer, which is what the `--wait` health-gate expects. Do not invoke `docker compose … up` directly.

The compose project seeds `roviq_test` (port 5433) and provisions Temporal, Novu, and notification-service. If Novu credentials can't be resolved (`helpers/novu.ts` reads from env, then from the `roviq-e2e_novu_creds` docker volume), notification-dependent suites flip to `describe.skip` with a reason — they do not fail the run.

## Making GraphQL requests

Use `gql<T>(query, variables?, token?)` from `./helpers/gql-client`. It POSTs raw `fetch` to `process.env.API_URL || 'http://localhost:3004/api/graphql'` and returns `FormattedExecutionResult<T>`. **Always** assert `res.errors` is undefined before reading `res.data`, because GraphQL reports field-level failures in `errors` with `data` partially populated.

```typescript
import assert from 'node:assert';
import { EmploymentType, Gender } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';

import { loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface StaffNode { id: string; employeeId: string; designation: string | null; }

describe('Staff E2E', () => {
  let accessToken: string;

  beforeAll(async () => {
    ({ accessToken } = await loginAsInstituteAdmin());
  });

  it('createStaffMember generates employeeId via tenant_sequences', async () => {
    const res = await gql<{ createStaffMember: StaffNode }>(
      `mutation Create($input: CreateStaffInput!) {
        createStaffMember(input: $input) { id employeeId designation }
      }`,
      {
        input: {
          firstName: { en: 'Rajesh' },
          lastName: { en: 'Sharma' },
          gender: Gender.MALE,
          designation: 'PGT Physics',
          employmentType: EmploymentType.REGULAR,
        },
      },
      accessToken,
    );
    expect(res.errors).toBeUndefined();
    const staff = res.data?.createStaffMember;
    assert(staff);
    expect(staff.employeeId).toBeTruthy();
  });
});
```

Pass credentials and IDs via `variables` — never string-interpolate them into the query.

## Auth helpers

All live in `./helpers/auth` and read credentials from `E2E_USERS` in `e2e/shared/e2e-users.ts`.

| Helper | Returns | Login path |
|---|---|---|
| `loginAsInstituteAdmin(instituteIndex = 0)` | `{ accessToken, refreshToken, tenantId }` | Two-step: `instituteLogin` → `selectInstitute` (admin is multi-institute) |
| `loginAsInstituteAdminSecondInstitute()` | `{ accessToken, tenantId }` | Same, but selects index `1` — use for cross-tenant / RLS tests |
| `loginAsPlatformAdmin()` | `{ accessToken, refreshToken }` | `adminLogin` |
| `loginAsReseller()` | `{ accessToken, refreshToken }` | `resellerLogin` |
| `loginAsTeacher()` | `{ accessToken, refreshToken }` | `instituteLogin` (single-institute, direct tokens) |
| `loginAsStudent()` | `{ accessToken, refreshToken, userId }` | `instituteLogin` |
| `loginAsGuardian()` | `{ accessToken, refreshToken, userId, membershipId }` | `instituteLogin` — `membershipId` is sourced from `SEED.GUARDIAN_USER.membershipId` so consent mutations that resolve the guardian profile off the membership work |

Helpers unwrap GraphQL errors internally — if login returns errors or empty data, they throw a descriptive message instead of silently returning `undefined` tokens.

## Seed data

```typescript
import { SEED, SEED_IDS } from '../../shared/seed';
```

`e2e/shared/seed.ts` re-exports `SEED_IDS` from `scripts/seed-ids.ts` (single source of truth) and mirrors the literals in `scripts/seed.ts`. Available keys:

- `INSTITUTE_1`, `INSTITUTE_2` — `{ id, name, nameHi }`
- `ADMIN_USER`, `TEACHER_USER`, `STUDENT_USER` — `{ id, username }`
- `GUARDIAN_USER` — `{ id, username, membershipId }` (membership is required by consent + guardian-scoped resolvers)
- `STUDENT_PROFILE_1`, `GUARDIAN_PROFILE_1` — `{ id }`
- `ACADEMIC_YEAR_INST1`, `ACADEMIC_YEAR_INST2` — `{ id }`
- `RESELLER` — `{ id, name }`

Never hardcode UUIDs or names in a test. If a new seeded entity is needed, add it to `scripts/seed.ts` **and** `e2e/shared/seed.ts` in the same change.

## Subscriptions

Subscriptions go through `subscribeOnce<T>(query, variables, token, timeoutMs = 5000)` in `./helpers/ws-client`. It handles the ws-ticket exchange transparently: the server rejects `Authorization` on `connection_init` and instead expects a single-use ticket fetched from `GET /api/auth/ws-ticket` with the bearer token. The helper does this for you.

Rules:

1. **Subscribe BEFORE mutating.** The iterator is only registered with pubSub after `connection_init` resolves — if the mutation fires first, the event is missed.
2. **Wait ~200ms after subscribing** before triggering the mutation. This lets `connection_init` round-trip and the subscription register server-side. This is the **only** fixed delay sanctioned in E2E specs.
3. **Select `__typename` when the emitter payload lacks model fields.** Some subscriptions declare `@Subscription(() => InstituteModel)` but the pubSub payload is `{ instituteId, changedFields }` — no `id`. Selecting `__typename` is safe because it resolves to the static type name without running field resolvers. Selecting `id` in that case will throw a null-field error at delivery time and the test will fail.
4. **Negative path = short timeout.** Cross-tenant / cross-scope isolation tests pass a shorter timeout (e.g. `2_500`) and `await expect(eventPromise).rejects.toThrow(/Subscription timeout/)`.

Real subscription names (spot-checked against `@Subscription(` in `apps/` and `ee/`):

- Institute scope: `instituteConfigUpdated`, `instituteBrandingUpdated`, `instituteUpdated`, `instituteSetupProgress`, `enquiryCreated`, `applicationStatusChanged`, `studentUpdated`, `studentsInTenantUpdated`, `groupMembershipResolved`
- Reseller scope: `resellerInstituteCreated`, `resellerInstituteStatusChanged`
- Platform scope: `adminInstituteApprovalRequested`, `adminInstituteCreated`
- Billing (institute): `mySubscriptionStatusChanged`, `myInvoiceGenerated`, `myPaymentStatusChanged`
- Billing (reseller): `resellerInvoiceGenerated`, `resellerPaymentReceived`, `resellerSubscriptionChanged`

```typescript
import { subscribeOnce } from './helpers/ws-client';

it('instituteConfigUpdated fires after updateInstituteConfig', async () => {
  type Envelope = { instituteConfigUpdated: { __typename: string } };
  const eventPromise = subscribeOnce<Envelope>(
    `subscription { instituteConfigUpdated { __typename } }`,
    {},
    accessToken,
  );

  await new Promise((r) => setTimeout(r, 200)); // connection_init warm-up

  const res = await gql(
    `mutation { updateInstituteConfig(input: { attendanceType: "LECTURE_WISE" }) { id } }`,
    undefined,
    accessToken,
  );
  if (res.errors) throw new Error(JSON.stringify(res.errors));

  const event = await eventPromise;
  expect(event.instituteConfigUpdated.__typename).toBe('InstituteModel');
});
```

## Temporal-backed workflows

Admission (`StudentAdmissionWorkflow`), TC issuance (`TCIssuanceWorkflow`), institute setup, compliance export, and bulk student import run inside Temporal workers. The workers are not yet registered in the e2e stack (tracked in **ROV-232**). Until that lands:

- Mutations that enqueue a workflow still return successfully — assert the response envelope.
- Assertions that depend on a post-workflow state (e.g. `ENROLLED`, `GENERATED`, `ISSUED`) go in a `describe.skip(...)` that names **ROV-232** in the title so the suite can be unskipped in one pass when the worker lands.

## Payment webhook simulation

`simulatePaymentWebhook(options)` in `./helpers/webhook` POSTs a signed body to `POST /api/webhooks/{razorpay|cashfree}/:resellerId`. No real gateway is involved. Options:

```typescript
await simulatePaymentWebhook({
  resellerId: SEED_IDS.RESELLER_DIRECT,
  invoiceId,
  tenantId,
  amountPaise: 99900,
  status: 'captured',          // 'captured' | 'failed' | 'refunded'
  gatewayPaymentId: 'pay_test_123',
  gateway: 'razorpay',         // default — or 'cashfree'
});
```

HMAC secret defaults to `process.env.RAZORPAY_WEBHOOK_SECRET` / `CASHFREE_WEBHOOK_SECRET` and must match the api-gateway's running config. The helper returns `{ status, body }` — assert `status === 200|201` before asserting on GraphQL-visible side effects.

## Novu notifications

`./helpers/novu` exposes `getNovuCreds`, `novuHealth`, `ensureNovuSubscriber`, `deleteNovuSubscriber`, `listNovuNotifications`, and `waitForNotification(subscriberId, timeoutMs)`. Credentials are resolved in order: env (`NOVU_API_URL`, `NOVU_SECRET_KEY`, `NOVU_APPLICATION_IDENTIFIER`) → the `roviq-e2e_novu_creds` docker volume populated by `novu-bootstrap`. The in-network `novu-api:3000` hostname is rewritten to the host-published `http://localhost:3443` automatically.

`notifications.api-e2e.spec.ts` is the canonical pattern: it calls `getNovuCreds()` at module load, catches any thrown error into a `skipReason`, and switches the top-level `describe` to `describe.skip` with that reason — specs do not fail if the stack is partially up.

## Enums — always UPPER_SNAKE from `@roviq/common-types`

```typescript
import { Gender, EmploymentType } from '@roviq/common-types';

gender: Gender.MALE,              // not 'male' or 'female'
employmentType: EmploymentType.REGULAR,
```

The migration surfaced several specs that copied lowercase strings out of legacy Hurl files (`'female'`, `'dynamic'`, `'active'`) which the current schema rejects at validation. Always import the enum; do not hand-roll strings for enum types. Values that are adapter literals (e.g. webhook `status: 'captured'`) are not GraphQL enums and stay as strings.

## i18nText fields

Backend fields declared with `@Field(() => I18nTextScalar)` accept a JSONB object and return JSONB. Pass `{ en: 'Value' }` (other locales optional; `en` is required by `i18nTextSchema`):

```typescript
input: { firstName: { en: 'Rajesh' }, lastName: { en: 'Sharma' } }
```

Plain-string fields (`description`, `designation`, `department`, group `name`) are not i18nText — pass a bare string.

## Per-domain minimum coverage

When adding a new domain spec, cover at minimum:

1. **CRUD happy path** — create, read, update, soft-delete as applicable.
2. **Auth rejection** — unauthenticated request returns `UNAUTHENTICATED`.
3. **Scope rejection** — wrong-scope token returns `FORBIDDEN`.
4. **Tenant isolation** — verify via `loginAsInstituteAdminSecondInstitute()` that tenant A cannot see tenant B's data.
5. **Error paths** — duplicate, not found, validation error.
6. **Lifecycle / state machine** — valid and invalid transitions, if the domain has one.
7. **Subscription coverage** — if the domain emits events, subscribe before the mutation and assert delivery + filter (same-scope fan-out, cross-tenant no-leak).

Cross-scope rejection and cross-tenant isolation that are already covered by the integration suite do not need duplication in E2E — the file docstring should call that out.

## Forbidden patterns

- **No workarounds** ([NWKRD]). If a mutation emits an incomplete subscription payload and your test has to hide a null-field error to pass, fix the emitter (or the subscription return type) in the same commit — do not narrow the selection to dodge the bug.
- **No new `.hurl` files.** Migration is one-way; new domain tests go directly in Vitest.
- **No `sleep()` / fixed delays.** The single exception is the ~200ms subscription warm-up above. For async state transitions (audit consumer, webhook → invoice status), poll with a bounded `waitFor(...)` pattern.
- **No mocks.** Everything hits the real running stack. If your spec needs to stub something, you're writing an integration test — move it to `apps/api-gateway/**/*.integration.spec.ts`.
- **No direct DB writes.** Integration tests own DB-level setup. E2E composes state via GraphQL mutations + seed fixtures. Reading via `psql -U roviq -d roviq_test` (port 5433) is fine for diagnosis, not for setup.
- **No hardcoded credentials or UUIDs.** Use `E2E_USERS` and `SEED` / `SEED_IDS`.
- **No string interpolation for credentials in GraphQL queries.** Always use the `variables` object (query-injection risk and makes the query cacheable).
- **No `describe.skip` without a reason + issue link.** The skip title must name the blocker (e.g. `ROV-232 — TCIssuanceWorkflow worker not registered`).
- **No `subscriptions-transport-ws`.** Use `graphql-ws` v6 via `subscribeOnce`.
- **No testing internal implementation details.** Assert on the externally observable outcome (GraphQL response, subscription event, Novu inbox entry), never on which NATS subject was published or which SQL ran.
