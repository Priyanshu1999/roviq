---
name: backend-service
description: Use when working on any backend service, resolver, repository, or module in apps/api-gateway — covers scope-to-DB-wrapper mapping, service layer rules, status transitions as domain mutations, schema patterns, event naming, and service ownership boundaries
---

# Backend Service Rules

## General Conventions

- DI for same-process communication, NestJS microservices (NATS) for inter-service
- `ConfigService` for all config — never `process.env`. All NestJS app modules must have `ConfigModule.forRoot({ isGlobal: true })`
- Single root `.env` for all config — new env vars must also go in `.env.example`

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

### Resolver Delete Pattern

Delete = one line: `await this.service.delete(id); return true;`. `softDelete()` throws `NotFoundException`/`ConflictException` directly. No try-catch, no result objects.

### Trash/Restore

Trash/restore needs CASL: `@CheckAbility({ action: 'manage', subject })`. Resolver calls a service method that reads from the **base table** (not the `*_live` view) so soft-deleted rows are visible. `withTrash()` no longer exists — soft-delete visibility is enforced at the application layer via `<table>_live` views (see `/drizzle-database` skill). Restore = `restoreDeleted(tx, table, id)` from `@roviq/database`.

## Enum Conventions

- **Document every value.** Every `pgEnum`, `as const` tuple, TS `enum`, or Zod `z.enum` option gets an inline comment on the line above explaining its domain meaning. No exceptions.
- **Single source in `@roviq/common-types`.** Any enum used by 2+ layers (database + api-gateway + frontend) lives in `libs/shared/common-types/src/lib/*-enums.ts` as `export const X_VALUES = [...] as const; export type X = (typeof X_VALUES)[number]; export const X = Object.fromEntries(X_VALUES.map(v=>[v,v])) as { readonly [K in X]: K };`. Database imports `X_VALUES` for `pgEnum`, api-gateway imports `X` for `@IsEnum`/`@IsIn`/`registerEnumType`, frontend imports both for Zod + Select. NEVER hand-list the same strings in a DTO, a pgEnum, and a Select. `apps/api-gateway` does not import enum VALUES from `@roviq/database`. Playbook: `docs/plans/enum-single-source-of-truth-migration.md`. Canonical example: `GuardianEducationLevel`. Legacy `export enum FooEnum {}` in a model file + separate pgEnum is the old pattern — migrate when touched.
- **Casing is `UPPER_SNAKE`, always.** Matches `userStatus`, `instituteStatus`, `subjectType`, `GuardianEducationLevel`. Existing lowercase enums (`resellerTier`, `resellerStatus`, `GuardianRelationship`, `STUDENT_DOCUMENT_TYPE_VALUES`, and any others) are a bug — tracked for migration in ROV-227. Do NOT add new lowercase enum values under any circumstance.

## GraphQL Decorators

`@Field`, `@InputType`, `@ObjectType`, and `registerEnumType` must carry a `description:` when the field name isn't self-explanatory — it's the only user-facing API doc the backend surfaces (shows up in SDL, Apollo DevTools, codegen). Mandatory for: business rules, format constraints, non-obvious units (paise, BigInt, epoch ms), validation gotchas, cross-reference to domain concepts. Trivial boolean toggles and obvious labels can skip.

## Code-First GraphQL

- NEVER use `.graphql` schema files — use code-first `@ObjectType`, `@Field`, `@Resolver` decorators exclusively
- Resolvers are thin wrappers — all business logic lives in services. Resolvers only call service methods and return results
- NATS consumers must be Pull-based, not Push — push consumers block and don't scale
- Tenant context flows via AsyncLocalStorage (`getRequestContext()`) — never pass `tenantId` as a manual parameter through the call chain

## Schema Patterns

- `entityColumns` spread on every business table (createdAt/By, updatedAt/By, deletedAt/By, version)
- `tenantColumns` spread on every tenant-scoped table (adds tenantId)
- Partial unique indexes: always include `WHERE deleted_at IS NULL` (lets soft-deleted rows reuse business-unique columns like UDISE / email / code)
- FORCE ROW LEVEL SECURITY on every table (via custom migration / `db-reset.ts` post-push loop)
- Optimistic concurrency: `WHERE version = expected` + `version = version + 1` on updates
- Soft delete: set `deletedAt`/`deletedBy` via `softDelete(tx, table, id)` — never `db.delete()`. Reads MUST go through the matching `<table>_live` view (security_invoker) — see `/drizzle-database` skill. Writes target the base table.
- New soft-deletable table → declare a `<table>Live` `pgView` in `libs/database/src/schema/live-views.ts` and run `pnpm check:live-views` before commit.

## Event Emission

- Inject `EventBusService` (from `apps/api-gateway/src/common/event-bus.service.ts`) and call `eventBus.emit('PREFIX.action', payload)`. Never inject `JETSTREAM_CLIENT` directly in services. EventBusService publishes to BOTH NATS JetStream AND GraphQL pubsub in one call.
- Every emit subject prefix MUST have a stream registered in `libs/backend/nats-jetstream/src/streams/stream.config.ts`. The `STREAMS registry coverage` test in `nats-jetstream:test` walks api-gateway sources and fails CI on missing streams.
- Always include `tenantId` in event payloads (create / update / delete / status-changed / link / unlink) so consumer DLQs can route on tenant id without a follow-up DB lookup.

## Scope Assertions in Resolvers

Use `assertResellerContext(user)` / `assertTenantContext(user)` from `@roviq/auth-backend` instead of `if (!user.resellerId) throw ...` — the helpers narrow the type and centralise the error shape.

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
