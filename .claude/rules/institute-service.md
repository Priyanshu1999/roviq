# Institute Service Rules

## Scope → DB Wrapper Mapping

| Scope | Guard | DB Wrapper | Repository Pattern |
|-------|-------|------------|-------------------|
| Institute | `@InstituteScope()` | `withTenant(db, tenantId, fn)` | `getTenantId()` from `getRequestContext()` |
| Reseller | `@ResellerScope()` | `withReseller(db, resellerId, fn)` | `getResellerId()` from `getRequestContext()` |
| Platform | `@PlatformScope()` | `withAdmin(db, fn)` | No tenant/reseller context needed |

## Service Layer

- Services ONLY talk to repositories — never import `DRIZZLE_DB`, `withAdmin`, `withTenant`, or Drizzle tables
- Services return repository `Record` types — GraphQL handles mapping via `@ObjectType` decorators
- Use `EventBusService` for event publishing — never inject `JETSTREAM_CLIENT` directly in services
- Use `BusinessException(ErrorCode.X, message)` for business errors — never `BadRequestException` with hardcoded strings
- Use `ForbiddenException` for scope/auth checks — never `throw new Error()`

## Status Changes = Named Domain Mutations

Never expose raw `updateStatus(id, { status })`. Each transition is a named method:

- `activate(id)`, `deactivate(id)`, `suspend(id, reason?)`, `reject(id)`
- `approve(id)` (pending_approval → pending)
- `archive(id)` (academic year completing → archived)

Each method validates the transition, updates status, and emits the domain event.

## Schema Patterns

- `entityColumns` spread on every business table (createdAt/By, updatedAt/By, deletedAt/By, version)
- `tenantColumns` spread on every tenant-scoped table (adds tenantId)
- Partial unique indexes: always include `WHERE deleted_at IS NULL`
- FORCE ROW LEVEL SECURITY on every table (via custom migration)
- Optimistic concurrency: `WHERE version = expected` + `version = version + 1` on updates
- Soft delete: set `deletedAt`/`deletedBy`, never `db.delete()`

## Identity Service Integration

**NEVER write directly to `memberships`, `users`, or `roles` tables** from the institute service. Always via NATS to Identity Service. Actor context propagated via NATS message headers.

The institute service owns:
- `institutes`, `institute_branding`, `institute_configs`, `institute_identifiers`, `institute_affiliations`
- `academic_years`, `standards`, `sections`, `subjects`, `standard_subjects`, `section_subjects`
- `institute_groups`

The Identity Service owns:
- `users`, `memberships`, `roles`, `profiles`, `refresh_tokens`, `auth_providers`

## Domain Language

- **"institute"** — never "school" or "organization" in code, comments, UI, docs
- **"tenant"** — the infrastructure term for institute (`tenant_id`, RLS policies, `withTenant()`)
- **"department"** — education level offered by an institute (pre_primary, primary, etc.)
- **"standard"** — a grade/class level (Class 5, 11th Science)
- **"section"** — a division within a standard (5-A, 5-B)

## Event Naming

NATS event pattern: `ENTITY.action` (e.g., `INSTITUTE.created`, `ACADEMIC_YEAR.activated`)
- Published via `EventBusService.emit()` which sends to both NATS and GraphQL PubSub
- Events are fire-and-forget — never await the publish
