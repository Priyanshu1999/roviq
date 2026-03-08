# Infrastructure

## Dev Environment

[Tilt](https://docs.tilt.dev/) orchestrates the dev environment. Infra runs in Docker (via `docker-compose.yml`), apps run locally.

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

## Database

### Roles
- `roviq` — default user, owns all tables, subject to RLS policies
- `roviq_admin` — inherits from `roviq` (via `GRANT roviq TO roviq_admin`), used for auth and admin operations. RLS bypass is **policy-based** (`app.is_platform_admin`), NOT role-level `BYPASSRLS`.

### RLS Policies
Tenant-scoped tables (`memberships`, `roles`, `refresh_tokens`, `profiles`, `student_guardians`) have:
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- Tenant isolation policy: `tenant_id = current_setting('app.current_tenant_id', true)::text`
- Admin bypass policy: `current_setting('app.is_platform_admin', true) = 'true'`

Platform tables (`users`, `organizations`, `phone_numbers`, `auth_providers`) have **no RLS**.

### Migrations
```bash
pnpm run db:migrate:dev   # Interactive dev migrations
pnpm run db:migrate       # Deploy migrations (CI/production)
pnpm run db:generate      # Regenerate Prisma client
pnpm run db:seed          # Seed test data
pnpm run db:reset         # Nuke DB + re-migrate
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
| DATABASE_URL | Prisma connection (roviq user, subject to RLS) |
| DATABASE_URL_ADMIN | Admin connection (roviq_admin, policy-based RLS bypass) |
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
| CORS_ORIGINS | Comma-separated allowed origins (optional, defaults to localhost) |
| PORT | Server port (optional, defaults to 3000) |
