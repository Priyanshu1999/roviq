# Staff & Guardians

## Overview

The staff and guardians module (Linear issue **ROV-169**) provides the institute-scoped CRUD surface for employees (teaching and non-teaching staff, their qualifications) and guardians (parents, legal guardians, emergency contacts) linked to students. The primary users are institute HR admins, receptionists, and principals managing staff onboarding, as well as admission clerks linking guardians to admitted students. All data is tenant-scoped via `withTenant()` and governed by RLS — only `user_profiles` reads cross into `withAdmin()` for joined reads.

## Routes

| Route | Component | Purpose | CASL ability |
|-------|-----------|---------|--------------|
| `/institute/people/staff` | [page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/staff/page.tsx) | Staff list with filters & search | `read Staff` |
| `/institute/people/staff/new` | [new/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/staff/new/page.tsx) | Hire staff wizard | `create Staff` |
| `/institute/people/staff/[id]` | [[id]/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/staff/[id]/page.tsx) | Staff detail tabs (Profile, Qualifications, Documents, Audit) | `read Staff` |
| `/institute/people/staff/[id]/edit` | [[id]/edit/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/staff/[id]/edit/page.tsx) | Edit staff profile | `update Staff` |
| `/institute/people/guardians` | [page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/page.tsx) | Guardian list | `read Guardian` |
| `/institute/people/guardians/new` | [new/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/new/page.tsx) | Add guardian | `create Guardian` |
| `/institute/people/guardians/[id]` | [[id]/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/[id]/page.tsx) | Guardian detail + linked students | `read Guardian` |

## GraphQL surface

| Operation | Type | Returns | CASL guard |
|-----------|------|---------|------------|
| `listStaff` | Query | `StaffConnection` | `read Staff` |
| `getStaffMember` | Query | `Staff` | `read Staff` |
| `createStaffMember` | Mutation | `Staff` | `create Staff` |
| `updateStaffMember` | Mutation | `Staff` | `update Staff` |
| `deleteStaffMember` | Mutation | `Boolean` | `delete Staff` |
| `listStaffQualifications` | Query | `[StaffQualification!]!` | `read Staff` |
| `createStaffQualification` | Mutation | `StaffQualification` | `update Staff` |
| `updateStaffQualification` | Mutation | `StaffQualification` | `update Staff` |
| `deleteStaffQualification` | Mutation | `Boolean` | `update Staff` |
| `listGuardians` | Query | `GuardianConnection` | `read Guardian` |
| `getGuardian` | Query | `Guardian` | `read Guardian` |
| `createGuardian` | Mutation | `Guardian` | `create Guardian` |
| `updateGuardian` | Mutation | `Guardian` | `update Guardian` |
| `deleteGuardian` | Mutation | `Boolean` | `delete Guardian` |
| `linkGuardianToStudent` | Mutation | `StudentGuardianLink` | `update Guardian` |
| `unlinkGuardianFromStudent` | Mutation | `Boolean` | `update Guardian` |
| `listLinkedStudents` | Query | `[Student!]!` | `read Guardian` |
| `listStudentGuardians` | Query | `[Guardian!]!` | `read Student` |
| `revokeGuardianAccess` | Mutation | `Boolean` | `update Guardian` |

Resolvers live under [apps/api-gateway/src/institute/staff/](apps/api-gateway/src/institute/staff/) and [apps/api-gateway/src/institute/guardian/](apps/api-gateway/src/institute/guardian/), decorated with `@InstituteScope()`.

## Database schema

- [`staff_profiles`](libs/database/src/schema/user-profiles/staff-profiles.ts) — employee code, department, designation, status enum.
- [`staff_qualifications`](libs/database/src/schema/user-profiles/staff-qualifications.ts) — degrees, institutions, years.
- [`guardian_profiles`](libs/database/src/schema/user-profiles/guardian-profiles.ts) — relationship enum, occupation, portal access flag.
- [`student_guardian_links`](libs/database/src/schema/user-profiles/student-guardian-links.ts) — many-to-many link table with `isPrimary`, `canPickup`, `notifyOn`.
- [`user_profiles`](libs/database/src/schema/user-profiles/user-profiles.ts) — joined for firstName/lastName/contact.

All tables spread `tenantColumns`; `student_guardian_links` uses `tenantPolicies()` for RLS.

## Multi-language names

Staff and guardian `firstName`/`lastName` are stored as `i18nText` jsonb (`{ "en": "Priya", "hi": "प्रिया" }`). Forms use `<I18nInput>` with the `i18nTextSchema` (English required, other locales optional per tenant `supportedLocales`). Reads resolve via `useI18nField()` with the `current → en → first available` fallback. Cross-locale search runs through `search_vector @@ plainto_tsquery('simple', query)`, so searching `"प्रिया"` returns the same row as `"Priya"`.

## Frontend patterns

- DataTable with `stickyFirstColumn` + `skeletonRows={8}` ([IXABI], [IMUXO])
- WindowedPagination with `1–25 of 243` window + page-size selector ([INREX])
- nuqs URL state for every filter — department, designation, status ([JSUFS])
- Floating bottom-sticky bulk action bar for staff status transitions ([JABGL])
- Optimistic concurrency via `version` field on `updateStaffMember` / `updateGuardian`
- DD/MM/YYYY date format for joining date, DOB ([GYATP])
- `<EntityTimeline>` for the audit tab

## Self-verification (manual smoke test)

1. `tilt trigger db-clean`, wait for `tilt logs db-clean` to show seed complete.
2. Login as institute admin, navigate to `/institute/people/staff`.
3. Verify list loads with seeded staff; filter by department and confirm URL updates via nuqs.
4. Click into a staff detail page → Qualifications tab → add a new qualification → verify row appears without full reload.
5. Navigate to `/institute/people/guardians` → create a new guardian with Hindi name (`<I18nInput>`).
6. From the guardian detail page, click "Link to student" → pick a seeded student → link succeeds.
7. Open the student detail → Guardians tab should list the newly linked guardian.
8. Click `revokeGuardianAccess` on the guardian → portal access flag flips; edit again still respects `version`.

## Known gaps + follow-ups

- Profile and consent management pages (privacy notices, consent records) are tracked in a separate sub-issue and still pending.
- Staff photo upload uses the generic `user_documents` pipeline; a staff-specific UX pass is queued.
- Bulk guardian import from admission CSV is handled in the admission module, not here.

## Commands

```bash
# Run lint + typecheck
pnpm biome check
pnpm exec tsc --noEmit -p apps/web/tsconfig.json
pnpm exec tsc --noEmit -p apps/api-gateway/tsconfig.app.json

# Run tests (requires pnpm db:reset --test for integration layer)
pnpm test                 # unit + component
pnpm test:int             # integration
pnpm test:e2e:ui          # playwright
```
