# Infrastructure

## Dev Environment

[Tilt](https://docs.tilt.dev/) orchestrates the dev environment. Infra runs in Docker (via `docker/compose.infra.yaml`), apps run locally.

```bash
tilt up              # Start everything
tilt down            # Stop everything
tilt get uiresources # Check resource status
```

Tilt UI: http://localhost:10350

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Primary database with RLS |
| Redis 7 | 6379 | CASL ability caching |
| NATS 2.10 | 4222 (client), 8222 (monitoring) | Inter-service messaging (JetStream) |
| MinIO | 9000 (API), 9001 (console) | S3-compatible object storage |
| Temporal | 7233 (gRPC) | Workflow orchestration |
| Temporal UI | 8233 | Temporal dashboard |
| OTel Collector | 4317 (gRPC), 4318 (HTTP), 13133 (health) | OpenTelemetry collector — receives traces/metrics/logs, fans out to Tempo/Loki/Prometheus |
| Tempo | 3200 | Distributed tracing backend (Grafana Tempo 2.7.2) |
| Loki | 3100 | Log aggregation backend |
| Prometheus | 9090 | Metrics scraping and storage |
| Grafana | 3001 | Observability dashboards — also embedded in admin-portal at `/observability` |

## Observability

The stack is wired end-to-end via OpenTelemetry:

```
App (OTel SDK) → OTel Collector (4317) → Tempo   (traces)
                                        → Loki    (logs)
                                        → Prometheus (metrics, namespace: roviq)
                                             ↓
                                        Grafana (3001) ← embedded in admin-portal
```

- **Traces**: auto-instrumented via `@opentelemetry/auto-instrumentations-node`. Sampling: 100% in dev, 10% in production.
- **Metrics**: exported every 10s in dev (60s in production). Metric names are prefixed `roviq_`.
- **Logs**: OTel Pino instrumentation injects `trace_id`/`span_id` into log records for correlation (log shipping to Loki requires a separate pipeline — not yet configured).
- **Grafana dashboard**: provisioned at `docker/grafana/dashboards/overview.json`, accessible at http://localhost:3001/d/roviq-overview or via the admin-portal Observability page.

## Database

### Roles
- `roviq` — bootstrap superuser, owns all tables. Used for **migrations only**, never at runtime.
- `roviq_app` — application runtime user (non-superuser, RLS enforced). Inherits table permissions from `roviq`.
- `roviq_admin` — admin operations (non-superuser, policy-based RLS bypass via `app.is_platform_admin`). Inherits table permissions from `roviq`.

### RLS Policies
Tenant-scoped tables (`memberships`, `roles`, `refresh_tokens`, `profiles`, `student_guardians`) have:
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- Tenant isolation policy: `tenant_id = current_setting('app.current_tenant_id', true)::uuid`
- Admin bypass policy: `current_setting('app.is_platform_admin', true) = 'true'`

Platform tables (`users`, `organizations`, `phone_numbers`, `auth_providers`) have **no RLS**.

### Migrations

Tilt runs migrations, client generation, and seeding automatically on `tilt up`. For manual use:

```bash
pnpm run db:migrate:dev   # Interactive dev migrations
pnpm run db:migrate       # Deploy migrations (CI/production)
pnpm run db:generate      # Regenerate Prisma client
pnpm run db:seed          # Seed test data
pnpm run db:reset         # Nuke DB + re-migrate (or use db-clean in Tilt UI)
```

## NATS JetStream Streams

| Stream | Subjects | Retention |
|--------|----------|-----------|
| INSTITUTE | INSTITUTE.> | workqueue |
| ADMIN | ADMIN.> | workqueue |
| NOTIFICATION | NOTIFICATION.> | workqueue |
| DLQ | *.DLQ, *.*.DLQ | limits |

Messages carry `correlation-id` and `tenant-id` in NATS headers.
Failed messages (after max retries) are published to `{subject}.DLQ` with full error context.
Max delivery attempts are configured at the consumer level, not the stream level.

## Environment Variables

Environment variables live in `.env` (gitignored). Copy `.env.example` to `.env` on first setup.

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | Application runtime (roviq_app, non-superuser, RLS enforced) |
| DATABASE_URL_ADMIN | Admin operations (roviq_admin, policy-based RLS bypass) |
| DATABASE_URL_MIGRATE | Migrations only (roviq superuser, schema changes) |
| REDIS_URL | Redis for CASL caching |
| NATS_URL | NATS JetStream server |
| JWT_SECRET | Access token signing |
| JWT_REFRESH_SECRET | Refresh token signing (must differ from JWT_SECRET) |
| JWT_EXPIRATION | Access token TTL (e.g. 15m) |
| JWT_REFRESH_EXPIRATION | Refresh token TTL (e.g. 7d) |
| S3_ENDPOINT | MinIO/S3 endpoint |
| S3_ACCESS_KEY | MinIO/S3 access key |
| S3_SECRET_KEY | MinIO/S3 secret key |
| S3_BUCKET_PREFIX | Prefix for tenant-scoped buckets |
| TEMPORAL_ADDRESS | Temporal server (host:port) |
| STRIPE_SECRET_KEY | Stripe API key (use sk_test_... for dev) |
| STRIPE_WEBHOOK_SECRET | Validates incoming Stripe webhook signatures |
| SENTRY_DSN | Sentry error tracking (leave empty to disable) |
| ALLOWED_ORIGINS | Comma-separated allowed origins for CORS and WebAuthn |
| API_GATEWAY_PORT | API Gateway port (optional, defaults to 3000) |
| OTEL_EXPORTER_OTLP_ENDPOINT | OTel Collector gRPC endpoint (default: http://localhost:4317) |
| OTEL_SERVICE_NAME | Service name reported in traces and metrics |
| OTEL_SERVICE_VERSION | Service version reported in traces and metrics |
| LOG_LEVEL | Pino log level (default: info) |
| NEXT_PUBLIC_API_URL | Public API base URL for browser-side requests (default: http://localhost:3000) |
| NEXT_PUBLIC_GRAFANA_URL | Grafana base URL for the admin-portal Observability iframe (default: http://localhost:3001) |
