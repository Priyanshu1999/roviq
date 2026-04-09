# Certificates & Transfer Certificates

## Overview

The certificates module (Linear issue **ROV-170**) provides the institute-scoped workflow for issuing Transfer Certificates (TCs), duplicate TCs, and other admission-related certificates (bonafide, character, migration, etc.). The primary users are institute principals and office clerks handling student exits and certificate requests from parents. Workflow is state-machine driven (`requested → approved → issued` with `rejected` as a terminal alternate) and every transition is audited. Groups (JsonLogic-based dynamic student cohorts) are scaffolded in the database but the frontend surface is not yet built.

## Routes

| Route | Component | Purpose | CASL ability |
|-------|-----------|---------|--------------|
| `/institute/certificates/tc` | [page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/tc/page.tsx) | TC register list with status filters | `read TC` |
| `/institute/certificates/tc/new` | [new/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/tc/new/page.tsx) | Request new TC for a student | `create TC` |
| `/institute/certificates/tc/[id]` | [[id]/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/tc/[id]/page.tsx) | TC detail + approve/reject/issue actions | `read TC` |
| `/institute/certificates` | [page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/page.tsx) | Issued certificates list | `read Certificate` |
| `/institute/certificates/new` | [new/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/new/page.tsx) | Request a new certificate (non-TC) | `create Certificate` |
| `/institute/certificates/[id]` | [[id]/page.tsx](apps/web/src/app/[locale]/institute/(dashboard)/certificates/[id]/page.tsx) | Certificate detail + download PDF | `read Certificate` |

## GraphQL surface

| Operation | Type | Returns | CASL guard |
|-----------|------|---------|------------|
| `listTCs` | Query | `TCConnection` | `read TC` |
| `getTCDetails` | Query | `TC` | `read TC` |
| `requestTC` | Mutation | `TC` | `create TC` |
| `requestDuplicateTC` | Mutation | `TC` | `create TC` |
| `approveTC` | Mutation | `TC` | `update TC` |
| `rejectTC` | Mutation | `TC` | `update TC` |
| `issueTC` | Mutation | `TC` | `update TC` |
| `listCertificates` | Query | `CertificateConnection` | `read Certificate` |
| `getCertificate` | Query | `Certificate` | `read Certificate` |
| `requestCertificate` | Mutation | `Certificate` | `create Certificate` |
| `issueCertificate` | Mutation | `Certificate` | `update Certificate` |

Resolvers live under [apps/api-gateway/src/institute/certificate/](apps/api-gateway/src/institute/certificate/) decorated with `@InstituteScope()`. Status transitions are exposed as named domain mutations — no raw `updateTC(id, { status })`.

## Database schema

- [`tc_register`](libs/database/src/schema/admission/tc-register.ts) — TC serial number, student FK, reason, status enum, issue date, duplicate flag.
- [`issued_certificates`](libs/database/src/schema/admission/issued-certificates.ts) — certificate instances with template FK, rendered PDF URL, serial number.
- [`certificate_templates`](libs/database/src/schema/admission/certificate-templates.ts) — tenant-configurable templates (bonafide, character, migration).
- [`groups`](libs/database/src/schema/groups/groups.ts) — dynamic student cohort definitions (backend only — see Known gaps).
- [`group_rules`](libs/database/src/schema/groups/group-rules.ts) — JsonLogic rule rows per group.
- [`group_members`](libs/database/src/schema/groups/group-members.ts) — materialized membership rows.
- [`group_children`](libs/database/src/schema/groups/group-children.ts) — group composition / nesting.

All tables spread `tenantColumns` and use `tenantPolicies()` for RLS.

## Multi-language names

Certificate templates and student name snapshots are stored as `i18nText` jsonb (`{ "en": "Bonafide", "hi": "मूल निवास" }`). The TC PDF renderer picks the tenant's default locale for the issued copy and falls back through `current → en → first available`. Forms use `<I18nInput>` + `i18nTextSchema`. Searching the TC register by student name uses `search_vector @@ plainto_tsquery('simple', query)` joined onto the student profile row.

## Frontend patterns

- DataTable with `stickyFirstColumn` + `skeletonRows={8}` ([IXABI], [IMUXO])
- WindowedPagination with `1–25 of 243` window + page-size selector ([INREX])
- nuqs URL state for status, date range, template type filters ([JSUFS])
- Floating bottom-sticky bulk action bar for bulk approve/reject ([JABGL])
- Optimistic concurrency via `version` field on status transitions
- DD/MM/YYYY date format for issue date, leaving date ([GYATP])
- `<EntityTimeline>` on detail page for the audit tab showing every transition

## Self-verification (manual smoke test)

1. `tilt trigger db-clean`, watch `tilt logs db-clean` until seed completes.
2. Login as institute admin, navigate to `/institute/certificates/tc`.
3. Click "Request TC" → pick a seeded student → submit; row appears in `requested` state.
4. Open the TC detail page → click "Approve" → status flips to `approved`, audit entry appears.
5. Click "Issue" → status flips to `issued`, PDF download link appears, `version` increments.
6. From student detail, request a duplicate TC → verify duplicate flag is set and a new row created.
7. Navigate to `/institute/certificates/new` → request a bonafide certificate → verify it appears in the issued certificates list after `issueCertificate`.
8. Try calling `issueTC` on an already-issued row via GraphQL playground → resolver returns `ConflictException` (invalid transition).

## Known gaps + follow-ups

- The Groups subsection (list + detail + new with JsonLogic builder) is **not yet built**. Backend schema (`groups`, `group_rules`, `group_members`, `group_children`) exists and is migrated, but no resolvers or pages are wired up. Tracked as a follow-up issue.
- Certificate template editor UI is stubbed — templates are currently seeded and edited via raw DB for development; a template admin surface will follow.
- Bulk TC issue (end-of-year batch) is a future enhancement; today each TC is issued individually.

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
