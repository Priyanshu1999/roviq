---
paths:
  - "e2e/api-gateway-e2e/**"
  - "ee/e2e/api-gateway-e2e/**"
  - "docker/compose.e2e.yaml"
  - "scripts/seed.ts"
  - "package.json"
---

## Backend E2E Testing Rules

1. **Isolated environment** — E2E runs via Docker Compose profiles: `docker compose -f docker/compose.e2e.yaml --profile hurl up --build --abort-on-container-exit`. Uses `roviq_test` database (created by `docker/init-db.sh`). NEVER run E2E against dev database. `down -v` on exit guarantees clean state. No shell scripts — Docker handles everything.

2. **Deterministic seed with fixed UUIDs** — `scripts/seed.ts` uses `SEED_IDS` with hardcoded UUIDs. Tests reference `SEED_IDS.INSTITUTE_1`, `SEED_IDS.USER_ADMIN`, etc. from `e2e-constants.ts`. Hurl tests use `{{institute_1_id}}` from `vars.e2e.env`. NEVER generate random data in tests.

3. **Hurl for sequential HTTP flows, Vitest for GraphQL** — Hurl: billing CRUD, subscription lifecycle (stateful, chained requests in `hurl/billing/`). Vitest: auth flows, audit pipeline, RLS isolation, complex GraphQL queries (in `src/`).

4. **Use `gql()` helper, not Apollo Client** — E2E uses raw `fetch` wrapper (`src/helpers/gql-client.ts`). Lightweight, no cache, no normalization. Pass JWT via `Authorization: Bearer` header.

5. **Shared auth helpers** — Use `loginAsAdmin()`, `loginAsTeacher()`, `loginAsStudent()` from `src/helpers/auth.ts`. NEVER inline login/selectInstitute flows in tests.

6. **Subscription tests use `subscribeOnce()`** — When WebSocket subscriptions exist: start subscription, wait 300ms for establishment, trigger mutation, await result with 5s timeout. Uses `graphql-ws` + `ws` package (`src/helpers/ws-client.ts`). NEVER poll for subscription results.

7. **Async assertions use polling** — For NATS-async operations (audit logs), poll with `for` loop + 500ms delay, max 10 attempts. NEVER use fixed `setTimeout` delays.

8. **CI runs both profiles** — Docker Compose with `--profile hurl --profile vitest` in GitHub Actions after build. Teardown always runs (`if: always()`).
