---
paths:
  - "apps/api-gateway/**"
  - "libs/database/**"
---

# Tenant Isolation & Authorization (Security-Critical)

## Row-Level Security (RLS)

- Three database roles: `roviq` (superuser, migrations only), `roviq_app` (runtime, RLS enforced), `roviq_admin` (admin, policy-based bypass)
- `DATABASE_URL` uses `roviq_app` (non-superuser), `DATABASE_URL_ADMIN` uses `roviq_admin`, `DATABASE_URL_MIGRATE` uses `roviq` superuser
- RLS bypass is policy-based, NOT role-level — no runtime role has `BYPASSRLS`
- `withAdmin()` calls `set_config('app.is_platform_admin', 'true', true)` before each query
- Each tenant-scoped table has an `admin_platform_access` policy checking this variable

## Platform vs Tenant Tables

- **Platform-level (NO RLS):** `users`, `institutes`, `phone_numbers`, `auth_providers` — use `withAdmin(db, fn)`
- **Tenant-scoped (RLS enforced):** `memberships`, `profiles`, `roles`, `refresh_tokens`, `student_guardians`, and all business data

## Drizzle DB Context Usage

```typescript
// Use withTenant for all tenant business logic — RLS enforces isolation
import { withTenant } from '@roviq/database';
const memberships = await withTenant(db, tenantId, (tx) =>
  tx.select().from(memberships).where(...)
);

// NEVER query tenant tables without withTenant — leaks cross-tenant data
// NEVER pass tenantId manually in WHERE — it flows via RLS

// Use withAdmin for platform-level operations (auth, billing, cross-tenant)
import { withAdmin } from '@roviq/database';
await withAdmin(db, async (tx) => { ... });

// NATS messages — propagate tenant + correlation headers
import { publish } from '@roviq/nats-utils';
await publish(js, 'INSTITUTE.attendance.marked', payload, { correlationId });
```

- Exception: `withAdmin()` for platform admin cross-tenant ops and auth service (user lookup at login).

## Drizzle Schema Change Checklist

Every tenant-scoped table MUST have ALL of these:
- `tenantId: uuid('tenant_id').notNull()` — use `tenantColumns` spread for standard tables
- Index on `tenant_id` — without this, RLS does full table scans
- RLS policies via `tenantPolicies('table_name')` helper (includes tenant isolation + admin bypass + soft-delete filter)

After ANY schema change:
- Run `pnpm db:push` to sync schema to DB
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
