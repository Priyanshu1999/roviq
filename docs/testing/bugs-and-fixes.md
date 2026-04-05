# Bugs Found & Fixes Applied

> 13 found, 12 fixed, 1 open | Session: 2026-04-05

## Bug List

| # | Portal | Page | Description | Status | Fix |
|---|--------|------|-------------|--------|-----|
| 1 | Reseller | Institute Detail | Breadcrumb shows raw UUID instead of institute name | **Fixed** | `useBreadcrumbOverride` hook with `useSyncExternalStore` in `breadcrumbs.tsx` |
| 2 | Reseller | Gateway Edit | UPI VPA not autofilled in edit dialog | **Fixed** | `setVpa(config?.upiVpa ?? '')` in `gateway-configs/page.tsx` |
| 3 | Reseller | Plans | `subscriberCount` field resolver fails without DB role context | **Fixed** | Wrapped `countByPlanIds()` in `withAdmin()` in `subscription.repository.ts` |
| 4 | Reseller | Plans/Subs/Invoices | `roviq_reseller` missing write GRANTs on billing tables | **Fixed** | Migration `20260405093000_fix-reseller-billing-grants` |
| 5 | All | Sessions | `mySessions` query 400 due to `lastActiveAt` vs `lastUsedAt` mismatch | **Fixed** | Renamed in `auth-mutations.ts`, `types.ts`, all 3 sessions pages |
| 6 | Admin | Institutes List | Shows "No institutes yet" — frontend queries `institutes` (InstituteScope) instead of `adminListInstitutes` (PlatformScope) | **Fixed** | Changed query + type in `use-institutes.ts` and `types.ts` |
| 7 | Admin | Institute Detail | Shows "Institute not found" — queries `institute(id)` (InstituteScope) instead of `adminGetInstitute(id)` | **Fixed** | Changed query + data path + all mutations to admin-scoped names |
| 7b | Admin | Institute Detail | Used generic `adminUpdateInstituteStatus(id, status)` — violates entity-lifecycle rule | **Fixed** | Replaced with named mutations: `adminDeactivateInstitute`, `adminSuspendInstitute` in both backend resolver and frontend |
| 8 | Admin | Institute Detail | No "Approve" button for PENDING_APPROVAL institutes | **Fixed** | Added Approve button + `actions.approve` i18n key (EN + HI) |
| 9 | Reseller | Create Institute | Department checkboxes show raw i18n keys (`resellerInstitutes.create.departmentOptions.PRE_PRIMARY`) | **Fixed** | Changed translation keys from lowercase to UPPER_CASE in both `en/resellerInstitutes.json` and `hi/resellerInstitutes.json` |
| 10 | Reseller | Assign Plan Dialog | Institute dropdown empty — queries `institutes` (InstituteScope) instead of `resellerListInstitutes` | **Fixed** | Changed query in `assign-plan-dialog.tsx` |
| 11 | Institute | Billing | `mySubscription` query returns null — resolver doesn't exist in backend schema | **Open (ROV-119, ROV-142)** | Already tracked: ROV-119 (backend resolvers) + ROV-142 (frontend page). Not implemented yet. |
| 12 | Reseller | Assign Plan | `roviq_reseller` GRANTs lost after `db-clean` — migration GRANTs not in `db-reset.ts` | **Fixed** | Added billing table GRANTs to `scripts/db-reset.ts` and `docker/init-db.sh` |
| 13 | Reseller | Assign Plan | Free plan assignment shows "Share checkout URL" toast | **Fixed** | Split success message: free plan → "assigned successfully", paid plan → redirect to `checkoutUrl` |

## Console Errors Observed

| # | Portal | Page | Error | Cause |
|---|--------|------|-------|-------|
| 1 | Reseller | Plans | "The user aborted a request" | Bug #4 (permission denied on INSERT) |
| 2 | All | Sessions | "Failed to load resource: 400" (x2) | Bug #5 (field name mismatch) |

## Files Changed

| File | Bug | Change |
|------|-----|--------|
| `apps/web/src/app/[locale]/reseller/(dashboard)/billing/gateway-configs/page.tsx` | #2 | VPA autofill |
| `ee/apps/api-gateway/src/billing/repositories/subscription.repository.ts` | #3 | `withAdmin()` on `countByPlanIds` |
| `libs/database/migrations/20260405093000_fix-reseller-billing-grants/migration.sql` | #4 | Reseller GRANTs |
| `libs/database/src/__tests__/reseller-billing-grants.integration.test.ts` | #4 | Integration test |
| `libs/frontend/auth/src/lib/auth-mutations.ts` | #5 | `lastActiveAt` -> `lastUsedAt` |
| `libs/frontend/auth/src/lib/types.ts` | #5 | `SessionInfo` type |
| `apps/web/src/app/[locale]/admin/(dashboard)/settings/sessions/page.tsx` | #5 | Field mapping |
| `apps/web/src/app/[locale]/reseller/(dashboard)/settings/sessions/page.tsx` | #5 | Field mapping |
| `apps/web/src/app/[locale]/institute/(dashboard)/settings/sessions/page.tsx` | #5 | Field mapping |
| `libs/frontend/ui/src/components/layout/breadcrumbs.tsx` | #1 | `useBreadcrumbOverride` + `useSyncExternalStore` |
| `libs/frontend/ui/src/index.ts` | #1 | Export hook |
| `apps/web/src/app/[locale]/reseller/(dashboard)/institutes/[id]/page.tsx` | #1 | Use override hook |
| `apps/web/src/app/[locale]/admin/(dashboard)/institutes/use-institutes.ts` | #6,#7 | Changed to `adminListInstitutes` + `adminGetInstitute` queries, named mutations |
| `apps/web/src/app/[locale]/admin/(dashboard)/institutes/types.ts` | #6,#7 | Updated type interfaces for admin-scoped queries |
| `apps/web/src/app/[locale]/admin/(dashboard)/institutes/[id]/page.tsx` | #7,#7b,#8 | `adminGetInstitute`, named mutation hooks, Approve button, `useBreadcrumbOverride` |
| `apps/web/src/app/[locale]/admin/(dashboard)/institutes/page.tsx` | #7 | Pass `reason` to `rejectInstitute` mutation |
| `apps/api-gateway/src/admin/institute/admin-institute.resolver.ts` | #7b | Replaced `adminUpdateInstituteStatus` with `adminDeactivateInstitute` + `adminSuspendInstitute` |
| `apps/web/messages/en/adminInstitutes.json` | #8 | Added `actions.approve` key |
| `apps/web/messages/hi/adminInstitutes.json` | #8 | Added `actions.approve` Hindi key |
| `apps/web/messages/en/resellerInstitutes.json` | #9 | Fixed department i18n key casing (lowercase -> UPPER_CASE) |
| `apps/web/messages/hi/resellerInstitutes.json` | #9 | Fixed department i18n key casing |
| `CLAUDE.md` | — | Added scoring rule |
