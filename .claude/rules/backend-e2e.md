---
paths:
  - "e2e/api-gateway-e2e/**"
  - "ee/e2e/api-gateway-e2e/**"
  - "docker/compose.e2e.yaml"
  - "scripts/e2e.sh"
  - "scripts/seed-e2e.ts"
---

## Backend E2E Testing Rules

1. **Isolated environment** — E2E runs via `./scripts/e2e.sh [hurl|vitest|all]`. Uses `docker/compose.e2e.yaml` with a separate `roviq_e2e` database. NEVER run E2E against dev database. `down -v` on exit guarantees clean state.

2. **Deterministic seed with fixed UUIDs** — `scripts/seed-e2e.ts` creates all test data with hardcoded UUIDs. Tests reference `E2E.PLATFORM_ADMIN.id`, `E2E.TENANT.id`, etc. from `e2e-constants.ts`. NEVER generate random data in tests.

3. **Hurl for sequential HTTP flows, Vitest for GraphQL + subscriptions** — Hurl: auth flows, billing CRUD, REST endpoints (stateful, chained requests). Vitest: complex GraphQL queries, subscriptions via `graphql-ws`, RLS isolation assertions, async audit log verification.

4. **Use `gql()` helper, not Apollo Client** — E2E uses raw `fetch` wrapper (`helpers/gql-client.ts`). Lightweight, no cache, no normalization. Pass JWT via `Authorization: Bearer` header.

5. **Subscription tests use `subscribeOnce()`** — Start subscription, wait 300ms for establishment, trigger mutation, await result with 5s timeout. Uses `graphql-ws` + `ws` package (Node WebSocket). NEVER poll for subscription results.

6. **Async assertions use polling** — For NATS-async operations (audit logs), poll with `for` loop + 500ms delay, max 10 attempts. NEVER use fixed `setTimeout` delays.

7. **EE billing Hurl tests go in `ee/e2e/`** — They're excluded from the public mirror via `.syncignore`. Current `e2e/api-gateway-e2e/hurl/paid/` should move there.

8. **CI runs `./scripts/e2e.sh all`** — Single step in GitHub Actions after build. Upload Hurl HTML report as artifact on failure.