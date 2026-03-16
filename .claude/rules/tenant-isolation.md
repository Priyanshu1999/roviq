---
paths:
  - "apps/api-gateway/**"
  - "libs/backend/prisma-client/**"
---

# Tenant Isolation & Authorization (Security-Critical)

## Row-Level Security (RLS)

- Three database roles: `roviq` (superuser, migrations only), `roviq_app` (runtime, RLS enforced), `roviq_admin` (admin, policy-based bypass)
- `DATABASE_URL` uses `roviq_app` (non-superuser), `DATABASE_URL_ADMIN` uses `roviq_admin`, `DATABASE_URL_MIGRATE` uses `roviq` superuser
- RLS bypass is policy-based, NOT role-level — no runtime role has `BYPASSRLS`
- `createAdminClient()` calls `set_config('app.is_platform_admin', 'true', true)` before each query
- Each tenant-scoped table has an `admin_platform_access` policy checking this variable

## Platform vs Tenant Tables

- **Platform-level (NO RLS):** `users`, `institutes`, `phone_numbers`, `auth_providers` — use `adminPrisma` typed as `AdminPrismaClient`
- **Tenant-scoped (RLS enforced):** `memberships`, `profiles`, `roles`, `refresh_tokens`, `student_guardians`, and all business data

## Prisma Client Usage

```typescript
// Use TenantPrismaClient for all tenant business logic — RLS enforces isolation
import { TenantPrismaClient } from '@roviq/prisma-client';
const memberships = await this.prisma.membership.findMany(); // auto-filtered by tenant

// NEVER use raw PrismaClient — leaks cross-tenant data
// NEVER pass tenantId manually — it flows via AsyncLocalStorage

// Use tenantTransaction wrapper (Prisma $transaction loses tenant context)
import { tenantTransaction } from '@roviq/prisma-client';
await tenantTransaction(this.prisma, async (tx) => { ... });

// NATS messages — propagate tenant + correlation headers
import { publish } from '@roviq/nats-utils';
await publish(js, 'INSTITUTE.attendance.marked', payload, { correlationId });
```

- Exception: `createAdminClient()` for platform admin cross-tenant ops and auth service (user lookup at login). Type as `AdminPrismaClient`, not `PrismaClient`.

## Prisma Schema Change Checklist

Every tenant-scoped table MUST have ALL of these:
- `tenantId String @map("tenant_id")` + FK to Institute
- `@@index([tenantId])` — without this, RLS does full table scans
- `@@map("snake_case_table_name")`
- All columns: `@map("snake_case")`, camelCase in Prisma
- Separate RLS migration immediately after:
  ```sql
  ALTER TABLE x ENABLE ROW LEVEL SECURITY;
  ALTER TABLE x FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation_x ON x
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  CREATE POLICY admin_platform_access_x ON x
    USING (current_setting('app.is_platform_admin', true) = 'true');
  ```

After ANY schema change:
- Update `scripts/seed.ts` to match the new schema
- Grep for old field names / unique constraints across `scripts/`, `e2e/`, and test files

## Authorization (CASL)

- Dynamic roles — abilities stored in DB, not hardcoded
- Memberships have personal `abilities` field combined with role abilities per request
- AbilityFactory reads from `Membership.abilities` (not User)

```typescript
// Use CASL guards and decorators
@UseGuards(GqlAuthGuard, AbilityGuard)
@CheckAbility({ action: 'create', subject: 'Attendance' })

// NEVER hardcode role checks
// BAD: if (user.role === 'teacher') { ... }
```
