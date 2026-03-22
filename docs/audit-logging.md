# Audit Logging

System-wide, immutable audit trail for all three scopes (platform, reseller, institute).

## Architecture

```
Mutation → AuditInterceptor → NATS JetStream (AUDIT.log)
                                    ↓
Service side-effects → AuditEmitter → NATS JetStream (AUDIT.log)
                                    ↓
                            AuditConsumer (batched)
                                    ↓
                        PostgreSQL audit_logs (partitioned)
                                    ↓
                        GraphQL query API (3 resolvers)
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `audit_logs` table | `libs/database/src/schema/audit/audit-logs.ts` | 19-column partitioned table with RLS |
| `AuditInterceptor` | `apps/api-gateway/src/audit/audit.interceptor.ts` | Gateway mutation capture (Layer 1) |
| `AuditEmitter` | `libs/backend/audit/src/audit-emitter.ts` | Service-level event emission (Layer 2) |
| `AuditConsumer` | `apps/api-gateway/src/audit/audit.consumer.ts` | Batched raw SQL writes from NATS |
| Resolvers | `apps/api-gateway/src/audit/audit.resolver.ts` | `adminAuditLogs`, `resellerAuditLogs`, `auditLogs`, `entityAuditTimeline` |
| Decorators | `libs/backend/audit/src/decorators/` | `@AuditMask()`, `@NoAudit()` |
| Partition workflow | `apps/api-gateway/src/audit/workflows/` | Temporal cron for monthly partition management |

## Database Schema

19 columns, partitioned by `created_at` (monthly), FORCE ROW LEVEL SECURITY:

- **Scope columns**: `scope`, `tenant_id` (nullable), `reseller_id` (nullable)
- **Actor columns**: `user_id`, `actor_id`, `impersonator_id`, `impersonation_session_id`
- **Event columns**: `action`, `action_type`, `entity_type`, `entity_id`, `changes` (JSONB), `metadata` (JSONB)
- **Tracing**: `correlation_id`, `ip_address`, `user_agent`, `source`
- **CHECK constraint** (`chk_audit_scope`): enforces scope/FK consistency

## RLS Policies (5 roles)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `roviq_app` | scope='institute' + tenant match | Yes | **Denied** | **Denied** |
| `roviq_reseller` | their institutes + own reseller entries | Yes | **Denied** | **Denied** |
| `roviq_admin` | All | All | All | All |
| `roviq_pooler` | **Denied** (NOINHERIT) | — | — | — |

## Partition Management (Temporal)

Monthly partitions created via Temporal cron workflow:

- **Schedule**: 25th of each month at 2 AM UTC (5-day safety margin)
- **Task queue**: `audit-maintenance`
- **Workflow**: `auditPartitionManagement`
- **Activities**: `createNextMonthPartition` (idempotent), `enforceRetention` (detach, not drop), `verifyPartitionHealth`
- **Retention**: 1 year default (per-tenant tiers deferred to billing)

### Running the worker

```bash
npx ts-node apps/api-gateway/src/audit/workflows/partition.worker.ts
```

### Registering the schedule

```bash
npx ts-node apps/api-gateway/src/audit/workflows/partition.schedule.ts
```

## CASL Authorization

`read:AuditLog` ability required. Granted to:
- `platform_admin`, `platform_support` (via `manage:all` / `read:all`)
- `reseller_full_admin`, `reseller_support_admin`, `reseller_viewer`
- `institute_admin` (via `manage:all`)

Not granted to: `teacher`, `student`, `parent`

## UI Components (`@roviq/ui`)

- `<AuditDiffRenderer>` — visual JSONB diff (UPDATE/CREATE/DELETE)
- `<ImpersonationBadge>` — scope-colored impersonation indicator
- `<EntityTimeline>` — embeddable entity audit history

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL_AUDIT` | pg Pool for audit consumer writes | `postgresql://roviq:roviq_dev@localhost:5432/roviq` |
| `TEMPORAL_ADDRESS` | Temporal server for partition workflow | `localhost:7233` |

## Testing

- **Unit tests**: `pnpm test` (interceptor: 38, consumer: 12, emitter: 9, helpers: 17)
- **Integration tests**: `pnpm test:integration` (15 audit + 22 security invariants)
- **E2E tests**: `tilt trigger e2e-gateway` (RLS, CHECK, idempotency, impersonation)
