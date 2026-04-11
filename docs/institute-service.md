# Institute Service

> Implemented in Phase 1–4 of the Institute Management milestone.
> PRD: `docs/plans/institute-service-prd-v3_1.md`

## Overview

The Institute Service manages the tenant root entity and its academic structure. An institute is the tenant — every tenant-scoped table has `tenant_id` FK pointing to `institutes.id`.

## Database Schema

### Core Tables

| Table | Scope | RLS | Description |
|-------|-------|-----|-------------|
| `institutes` | Platform | entityPolicies + custom reseller | Tenant root entity |
| `institute_branding` | Tenant | tenantPolicies | One-to-one: logo, colors, theme |
| `institute_configs` | Tenant | tenantPolicies | One-to-one: attendance, shifts, norms |
| `institute_identifiers` | Tenant | tenantPolicies | One-to-many: UDISE+, CBSE, BSEH codes |
| `institute_affiliations` | Tenant | tenantPolicies | One-to-many: board affiliations |
| `institute_groups` | Platform | Custom (admin/reseller/app) | Informational grouping (trust/society) |

### Academic Structure Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `academic_years` | Tenant | Academic year with term structure |
| `standards` | Tenant | Grade/class levels per academic year |
| `sections` | Tenant | Divisions within standards (A, B, C) |
| `subjects` | Tenant | Academic subjects per institute |
| `standard_subjects` | Tenant | M:M junction: subject ↔ standard |
| `section_subjects` | Tenant | M:M junction: subject ↔ section |

### Key Schema Features

- **Soft delete** via `entityColumns` (deletedAt, deletedBy, version)
- **Optimistic concurrency** on `updateInstituteInfo` via `WHERE version = expected`
- **FORCE ROW LEVEL SECURITY** on all tables (custom migrations)
- **Partial unique indexes** with `WHERE deleted_at IS NULL` on code, name, etc.
- **pgEnum types**: `InstituteStatus`, `AcademicYearStatus`, `EducationLevel`, `SetupStatus`, etc.
- **JSONB columns**: contact (phones/emails), address, stream config, section strength norms
- **Zod validation** for Contact and Address JSONB (`instituteContactSchema`, `instituteAddressSchema`)

## Institute Status Lifecycle

```
pending_approval → pending → active → inactive → active (reactivation)
                     ↓                   ↓
                   rejected         suspended → active (un-suspend)
```

| Status | Meaning |
|--------|---------|
| `PENDING_APPROVAL` | Reseller-created, awaiting platform admin review |
| `PENDING` | Approved, Temporal setup workflow running |
| `ACTIVE` | Operational, setup complete, logins enabled |
| `INACTIVE` | Voluntarily deactivated, data preserved |
| `SUSPENDED` | Forcibly blocked by admin/reseller |
| `REJECTED` | Terminal — admin denied the request |

## Academic Year Lifecycle

```
PLANNING → ACTIVE → COMPLETING → ARCHIVED
```

- Exactly one active per institute (partial unique index)
- CHECK constraint: `start_date < end_date`
- Overlap validation for schools (coaching exempt)
- Activation deactivates current year in single transaction

## Three-Scope Resolver Architecture

### Platform Scope (`@PlatformScope()`, `withAdmin()`)

Located in `apps/api-gateway/src/admin/institute/`:

| Resolver | CASL Action | Description |
|----------|-------------|-------------|
| `adminCreateInstitute` | `create:Institute` | Creates with status=pending, triggers Temporal |
| `adminApproveInstitute` | `approve:Institute` | pending_approval → pending |
| `adminActivateInstitute` | `activate:Institute` | pending/inactive/suspended → active |
| `adminRejectInstitute` | `reject:Institute` | → rejected (terminal) with reason |
| `adminDeactivateInstitute` | `deactivate:Institute` | active → inactive |
| `adminSuspendInstitute` | `suspend:Institute` | any → suspended with optional reason |
| `adminListInstitutes` | `read:Institute` | Full-text search + filters |
| `adminGetInstitute` | `read:Institute` | Full detail with nested data |
| `adminDeleteInstitute` | `delete:Institute` | Soft delete (platform admin only) |
| `adminRestoreInstitute` | `restore:Institute` | Restore from trash |
| `adminInstituteStatistics` | `view_statistics:Institute` | Cross-tenant aggregate stats |

### Reseller Scope (`@ResellerScope()`, `withReseller()`)

Located in `apps/api-gateway/src/reseller/institute/`:

| Resolver | CASL Action | Tier Required |
|----------|-------------|---------------|
| `resellerCreateInstituteRequest` | `create:Institute` | full_management |
| `resellerListInstitutes` | `read:Institute` | all tiers |
| `resellerGetInstitute` | `read:Institute` | all tiers |
| `resellerSuspendInstitute` | `suspend:Institute` | full_management |
| `resellerReactivateInstitute` | `activate:Institute` | full_management |
| `resellerInstituteStatistics` | `view_statistics:Institute` | all tiers |

Reseller institute group resolvers in `apps/api-gateway/src/reseller/institute-group/`:

| Resolver | CASL Action | Tier Required |
|----------|-------------|---------------|
| `resellerCreateInstituteGroup` | `create:InstituteGroup` | full_management |
| `resellerListInstituteGroups` | `read:InstituteGroup` | all tiers |

### Institute Scope (`@InstituteScope()`, `withTenant()`)

Located in `apps/api-gateway/src/institute/management/`:

| Resolver | CASL Action | Description |
|----------|-------------|-------------|
| `myInstitute` | `read:Institute` | Own institute with @ResolveField for branding/config/identifiers/affiliations |
| `updateInstituteInfo` | `update_info:Institute` | Name, code, contact, address + optimistic concurrency |
| `updateInstituteBranding` | `update_branding:Institute` | Logo, colors, theme |
| `updateInstituteConfig` | `update_config:Institute` | Attendance, shifts, grading, norms |

Academic structure resolvers in `apps/api-gateway/src/institute/`:

| Module | Resolvers |
|--------|-----------|
| `standard/` | CRUD + filter by level/department/year |
| `section/` | CRUD + `assignClassTeacher` |
| `subject/` | CRUD + `assignToStandard` + `assignToSection` |
| `academic-year/` | CRUD + `activateAcademicYear` + `archiveAcademicYear` |

## CASL Actions

Granular actions defined in `AppAction`:

| Action | Used For |
|--------|----------|
| `update_info` | Institute basic info (name, code, contact) |
| `update_branding` | Visual branding (logo, colors) |
| `update_config` | Operational config (attendance, shifts) |
| `approve` | Approve a pending entity (e.g. institute approval) |
| `activate` | Academic year activation |
| `archive` | Academic year archival |
| `assign_teacher` | Section teacher assignment |
| `view_statistics` | Dashboard aggregate metrics |
| `restore` | Restore soft-deleted entities |

## RLS & GRANTs

### Institute Tables

- `roviq_app`: SELECT only on `institutes` (tenant root)
- `roviq_app`: Full CRUD on child tables (branding, configs, identifiers, affiliations)
- `roviq_reseller`: SELECT + INSERT + UPDATE on `institutes` (create with approval, suspend)
- `roviq_reseller`: SELECT only on child tables
- `roviq_admin`: Full access everywhere
- All audit_logs: immutable for non-admin (SELECT + INSERT only)
- FORCE ROW LEVEL SECURITY on every table

### Request Context

`RequestContext` (ALS) provides: `tenantId`, `resellerId`, `userId`, `scope`, `impersonatorId`, `correlationId`

## NATS Events

Published via `EventBusService` (NATS + GraphQL PubSub):

| Event | Payload |
|-------|---------|
| `INSTITUTE.created` | instituteId, type |
| `INSTITUTE.approved` | instituteId, resellerId |
| `INSTITUTE.approval_requested` | instituteId, resellerId, requestedBy |
| `INSTITUTE.activated` | instituteId, previousStatus |
| `INSTITUTE.suspended` | instituteId, reason, scope |
| `INSTITUTE.deleted` | instituteId |
| `INSTITUTE.restored` | instituteId |
| `INSTITUTE.branding_updated` | instituteId, branding |
| `INSTITUTE.config_updated` | instituteId, changedFields |
| `INSTITUTE.status_changed` | instituteId, resellerId, previousStatus, newStatus |

Academic events: `ACADEMIC_YEAR.created/activated/archived`, `STANDARD.created/updated/deleted`, `SECTION.created/updated/deleted/teacher_assigned`, `SUBJECT.created/deleted/assigned_to_standard/assigned_to_section/removed_from_standard/removed_from_section`

## GraphQL Subscriptions

| Subscription | Scope | Filter |
|-------------|-------|--------|
| `instituteUpdated` | Institute | tenantId from JWT |
| `instituteBrandingUpdated` | Institute | tenantId from JWT |
| `instituteConfigUpdated` | Institute | tenantId from JWT |
| `instituteSetupProgress` | Institute | tenantId from JWT |
| `resellerInstituteCreated` | Reseller | resellerId from JWT |
| `resellerInstituteStatusChanged` | Reseller | resellerId from JWT |
| `adminInstituteApprovalRequested` | Platform | no filter |
| `adminInstituteCreated` | Platform | no filter |

## Temporal Setup Workflow

`InstituteSetupWorkflow` — 5-phase provisioning pipeline:

1. **Identity** (sequential): Admin role + membership + system role via NATS stubs
2. **Infrastructure** (parallel): Storage bucket + wallets + default roles
3. **Configuration** (parallel): Notification config + institute config with board norms + first academic year
4. **Academic Structure**: Standards + sections + subjects from board catalog
5. **Demo Data** (conditional): Sample data if `isDemo=true`, notifications disabled

Timeout: 10 minutes. All activities idempotent. Progress via NATS → `instituteSetupProgress` subscription.

## Board Catalogs

JSON seed files in `libs/database/seed/board-catalogs/`:

- `cbse.json` — CBSE subjects with official board codes (041 Math, 042 Physics, etc.)
- `bseh.json` — BSEH subjects
- `rbse.json` — RBSE subjects

Each covers Classes 9–12 with subject names, types, mark splits.

## Error Codes

Defined in `@roviq/common-types` `ErrorCode`:

| Code | HTTP | Domain |
|------|------|--------|
| `INSTITUTE_NOT_FOUND` | 404 | |
| `INSTITUTE_CODE_DUPLICATE` | 409 | |
| `SETUP_NOT_COMPLETE` | 422 | Cannot activate before setup |
| `CONCURRENT_MODIFICATION` | 409 | Version mismatch |
| `ACADEMIC_YEAR_OVERLAP` | 400 | Schools only |
| `INVALID_DATE_RANGE` | 400 | start >= end |
| `YEAR_ALREADY_ACTIVE` | 409 | |
| `STANDARD_NAME_DUPLICATE` | 409 | |
| `SECTION_NAME_DUPLICATE` | 409 | |
| `STREAM_REQUIRED` | 400 | Senior secondary |
| `SECTION_CAPACITY_EXCEEDED` | 422 | |
| `SUBJECT_CODE_DUPLICATE` | 409 | |

## Code Patterns

### Service Layer
- Services ONLY talk to repositories — never import DB/Drizzle directly
- Return `Record` types (not GraphQL Model) — GraphQL handles mapping via `@ObjectType`
- Named domain mutations for status changes (`suspend()`, not `updateStatus('SUSPENDED')`)
- `EventBusService` for publishing (NATS + PubSub in one call)

### Repository Layer
- Abstract class → Drizzle implementation (DI via NestJS)
- `withAdmin()` / `withReseller()` / `withTenant()` wrappers
- Typed with pgEnum-derived types (`InstituteStatus`, `AcademicYearStatus`)
- Optimistic concurrency via `WHERE version = expected`
