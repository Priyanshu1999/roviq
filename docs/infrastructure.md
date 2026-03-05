# Infrastructure

## Docker Services

```bash
docker compose up -d    # start all
docker compose down     # stop all
```

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
- `roviq` — default user, subject to RLS policies
- `roviq_admin` — BYPASSRLS, used for auth and admin operations

### RLS Policies
All tenant-scoped tables (`users`, `roles`, `refresh_tokens`) have:
- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`
- Policy: `tenant_id = current_setting('app.current_tenant_id', true)::text`

The `organizations` table has no RLS.

### Migrations
```bash
bun run db:migrate     # uses dotenvx + prisma migrate deploy
bun run db:seed        # seeds test data
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

Environment is managed via dotenvx. `.env.development` contains encrypted values and is committed.
`.env.keys` holds the private decryption key and is gitignored — get it from a team member.

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | Prisma connection (roviq user, subject to RLS) |
| DATABASE_URL_ADMIN | Admin connection (roviq_admin, bypasses RLS) |
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
