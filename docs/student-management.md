# Student Management

## Overview

The student management module (Linear issue **ROV-167**) provides the institute-scoped CRUD, search, enrollment, and lifecycle surface for student records. The primary users are institute admins, receptionists, and class teachers who need to admit, enroll, edit, transition, and search students from the institute portal. All data is tenant-scoped via `withTenant()` and subject to RLS; platform admins access student rows via `withAdmin()` for cross-tenant operations only.

## Routes

| Route | Component | Purpose | CASL ability |
|-------|-----------|---------|--------------|
| `/institute/people/students` | [page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/students/page.tsx) | Student list with filters, search, bulk actions | `read Student` |
| `/institute/people/students/new` | [new/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/students/new/page.tsx) | Admit new student wizard | `create Student` |
| `/institute/people/students/[id]` | [[id]/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/students/[id]/page.tsx) | Student detail tabs (Profile, Academics, Guardians, Documents, Fees, Audit) | `read Student` |
| `/institute/people/students/[id]/edit` | [[id]/edit/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/people/students/[id]/edit/page.tsx) | Edit profile | `update Student` |

## GraphQL surface

| Operation | Type | Returns | CASL guard |
|-----------|------|---------|------------|
| `listStudents` | Query | `StudentConnection` | `read Student` |
| `getStudent` | Query | `Student` | `read Student` |
| `createStudent` | Mutation | `Student` | `create Student` |
| `updateStudent` | Mutation | `Student` | `update Student` |
| `deleteStudent` | Mutation | `Boolean` | `delete Student` |
| `transitionStudentStatus` | Mutation | `Student` | `update Student` |
| `listStudentAcademics` | Query | `[StudentAcademic!]!` | `read Student` |
| `listStudentGuardians` | Query | `[Guardian!]!` | `read Student` |
| `listStudentDocuments` | Query | `[UserDocument!]!` | `read Student` |
| `enrollStudent` | Mutation | `StudentAcademic` | `update Student` |
| `updateStudentSection` | Mutation | `StudentAcademic` | `update Student` |
| `studentStatistics` | Query | `StudentStatistics` | `read Student` |
| `studentUpdated` | Subscription | `Student` | `read Student` |

Resolvers live under [apps/api-gateway/src/institute/student/](apps/api-gateway/src/institute/student/) and are decorated with `@InstituteScope()`.

## Database schema

- [`student_profiles`](libs/database/src/schema/user-profiles/student-profiles.ts) — core student row with admission no, status enum, `search_vector` for FTS.
- [`student_academics`](libs/database/src/schema/user-profiles/student-academics.ts) — per-academic-year enrollment (standard, section, roll number).
- [`student_guardian_links`](libs/database/src/schema/user-profiles/student-guardian-links.ts) — link table (read-only from student service; writes via guardian service).
- [`user_profiles`](libs/database/src/schema/user-profiles/user-profiles.ts) — joined for firstName/lastName/dob.
- [`user_documents`](libs/database/src/schema/user-profiles/user-documents.ts) — joined via `withAdmin()` for Aadhar/birth cert uploads.

All tables spread `tenantColumns` and use `tenantPolicies()` for RLS + admin bypass + soft-delete filter.

## Multi-language names

`firstName` and `lastName` are stored as `i18nText` jsonb (`{ "en": "Raj", "hi": "राज" }`). Forms use `<I18nInput>` from `@roviq/ui` with the `i18nTextSchema` from `common/validators.ts` (English required, other locales optional per tenant `supportedLocales`). Reads resolve via `useI18nField()` with fallback chain `current → en → first available`. Multilingual full-text search runs through `search_vector @@ plainto_tsquery('simple', query)`, indexed per student row so `"राज"` and `"Raj"` both resolve the same record.

## Frontend patterns

- DataTable with `stickyFirstColumn` + `skeletonRows={8}` ([IXABI], [IMUXO])
- WindowedPagination with `1–25 of 243` window + page-size selector ([INREX])
- nuqs URL state for every filter — standard, section, status, search ([JSUFS])
- Floating bottom-sticky bulk action bar for multi-select actions ([JABGL])
- Optimistic concurrency via `version` field passed to `updateStudent`
- DD/MM/YYYY date format via `useFormatDate()` ([GYATP])
- `<EntityTimeline>` for the audit tab consuming `auditLogs` query

## Self-verification (manual smoke test)

1. `tilt trigger db-clean` then watch `tilt logs db-clean` until seed completes.
2. Login as institute admin, navigate to `/institute/people/students`.
3. Verify list loads with the seeded students and pagination footer shows `1–25 of N`.
4. Search `राज` — should hit the Hindi name via `search_vector` and return results.
5. Click a student → detail page renders with all 6 tabs (Profile, Academics, Guardians, Documents, Fees, Audit).
6. Edit profile, save → verify `version` increments; edit again and save — still works (optimistic concurrency).
7. Open the status transition dropdown → pick a destructive transition (e.g. `suspend`) → confirmation dialog prompts for reason.
8. In a second tab edit the same student — first tab should receive `studentUpdated` subscription event and flash the changed row.

## Known gaps + follow-ups

- [IXABI] sticky cols + [IMUXO] skeleton rows are wired via the `@roviq/ui` DataTable extension shipped in this issue.
- The 4th test layer (unit) is supplemental — pure-function helpers are not yet extracted from `StudentService`; currently covered by integration tests only.
- Bulk import from CSV/Excel is a follow-up issue; the floating action bar only exposes bulk status transitions today.

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
