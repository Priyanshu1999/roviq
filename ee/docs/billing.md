# Billing Module

Enterprise-only billing system for managing subscription plans, subscriptions, invoices, and payment gateway integrations.

## Architecture

```
ee/apps/api-gateway/src/billing/     # NestJS billing feature module
ee/libs/backend/payments/            # @roviq/ee-payments — provider-agnostic payment gateway lib
```

### Feature module (`ee/apps/api-gateway/src/billing/`)

| File | Purpose |
|------|---------|
| `billing.module.ts` | Wires BillingRepository, BillingService, BillingResolver, WebhookController; imports PaymentsModule + NATS client |
| `billing.service.ts` | All business logic — plan CRUD, subscription lifecycle, invoice creation, webhook processing |
| `billing.repository.ts` | Drizzle queries via `withAdmin()`; all operations run through RLS |
| `billing.resolver.ts` | Code-first GraphQL resolver — thin, delegates to service |
| `webhook.controller.ts` | REST `POST /webhooks/razorpay` and `POST /webhooks/cashfree` — verifies signatures, delegates to service |
| `dto/` | GraphQL input types with `class-validator` decorators |
| `models/` | GraphQL object types (code-first) |

### Payment gateway library (`ee/libs/backend/payments/`)

Provider-agnostic abstraction over Razorpay and Cashfree.

| File | Purpose |
|------|---------|
| `ports/payment-gateway.port.ts` | `PaymentGateway` interface — the contract all adapters implement |
| `adapters/razorpay.adapter.ts` | Razorpay implementation |
| `adapters/cashfree.adapter.ts` | Cashfree implementation |
| `factory/payment-gateway.factory.ts` | `PaymentGatewayFactory` — resolves the correct adapter by provider name or institute config |
| `payments.module.ts` | NestJS module exporting `PaymentGatewayFactory` |

## Data Model

### Tables (all in `subscription_plans`, `subscriptions`, `invoices`, `payment_gateway_configs`, `payment_events`)

- **SubscriptionPlan** — plan definitions (name, amount, currency, interval, feature limits, isActive)
- **Subscription** — links an institute to a plan; tracks status, provider IDs, billing periods
- **Invoice** — payment records tied to subscriptions; tracks amount, status, billing period
- **PaymentGatewayConfig** — one per institute, stores which provider (Razorpay/Cashfree) they use
- **PaymentEvent** — idempotent webhook event log; `providerEventId` unique constraint prevents duplicate processing

### RLS

All billing tables (except `subscription_plans`) have Row-Level Security:
- `tenant_isolation_*` policies scope reads/writes by `institute_id` using `app.current_tenant_id`
- `admin_platform_access_*` policies grant platform admins full access via `app.is_platform_admin`
- `subscription_plans` has no RLS — plans are platform-level, visible to all

## Subscription Lifecycle

```
[Plan Created] ──▶ assignPlanToInstitute
                         │
                    ┌─────┴──────┐
                    │ Free plan  │ Paid plan
                    │ (amount=0) │ (amount>0)
                    ▼            ▼
               ACTIVE      PENDING_PAYMENT ──webhook──▶ ACTIVE
                    │            │
                    ▼            ▼
               CANCELED    ┌──────────────┐
                           │  PAST_DUE    │◀── halted/past_due webhook
                           │  PAUSED      │◀── pause action or webhook
                           │  CANCELED    │◀── cancel action or webhook
                           │  COMPLETED   │◀── completed webhook
                           └──────────────┘
```

### Free plans (amount=0)
- No payment gateway interaction
- Subscription goes directly to ACTIVE
- No checkout URL returned
- Cancel sets CANCELED immediately (no proration)

### Paid plans
- Gateway creates a provider plan + provider subscription
- Returns a checkout URL for the institute to complete payment
- Provider webhooks drive status transitions (activated → ACTIVE, halted → PAST_DUE, etc.)
- Cancel at cycle end: records `canceledAt`, provider webhook sets CANCELED when period ends
- Cancel immediately: calls gateway cancel, sets CANCELED; provider handles proration/refunds

## Webhook Processing

1. `POST /webhooks/{razorpay|cashfree}` receives raw request
2. Controller verifies signature via `gateway.verifyWebhook()`
3. `billingService.processWebhookEvent()` atomically claims event (unique `providerEventId`)
4. Processes subscription status change + creates invoice on charge/capture
5. Marks event as processed only after handler succeeds (failed handlers leave events retryable)
6. Emits NATS event for downstream consumers

## Event Bus

All state changes emit NATS events via `ClientProxy`:
- `billing.plan.created`, `billing.plan.updated`
- `billing.subscription.created`, `.canceled`, `.paused`, `.resumed`
- `billing.webhook.{provider}`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RAZORPAY_KEY_ID` | For Razorpay | API key ID |
| `RAZORPAY_KEY_SECRET` | For Razorpay | API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | For Razorpay | Webhook signature verification |
| `CASHFREE_CLIENT_ID` | For Cashfree | Client ID |
| `CASHFREE_CLIENT_SECRET` | For Cashfree | Client secret |
| `CASHFREE_ENVIRONMENT` | For Cashfree | `SANDBOX` or `PRODUCTION` |
| `CASHFREE_API_VERSION` | For Cashfree | API version (e.g., `2025-01-01`) |
| `BILLING_RETURN_URL` | Yes (EE) | Redirect URL after checkout (e.g., `http://localhost:4200/billing/subscriptions`) |
| `ROVIQ_EE` | Yes | Set to `true` to load BillingModule |

## Testing

```bash
# Unit tests (no external services needed)
nx run api-gateway:test -- billing
nx run ee-payments:test

# E2E — hurl tests (runs in Docker: gateway + test DB + hurl)
pnpm e2e:hurl

# E2E — vitest integration tests
pnpm e2e:vitest

# Both
pnpm e2e:all

# Teardown
pnpm e2e:down
```

**Unit tests** mock the repository, NATS client, and payment gateway factory. No DB or external services required.

**Hurl E2E tests** (`e2e/api-gateway-e2e/hurl/`) run the full billing flow against a live gateway: login → create plan → assign to institute → subscription lifecycle (cancel, pause, resume). The `--paid` profile tests paid subscriptions with sandbox gateway credentials.
