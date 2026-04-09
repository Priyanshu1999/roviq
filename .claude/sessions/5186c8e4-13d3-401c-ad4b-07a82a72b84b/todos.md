# Todos — session 5186c8e4-13d3-401c-ad4b-07a82a72b84b

> Checklist mirror of the live `TodoWrite` tool state. Every item carries `[start → end]` timestamps. Ongoing items use `…` as the end marker.

## Completed

- [x] `[02:10 → 02:25]` Verify ROV-167 / 169 / 170 scope — discovered all three are already committed (`4ca5d66`, `8c485a5`, `9c9f425`); pivoted scope to verification + detail page fixes
- [x] `[02:25 → 02:50]` Guardian `GuardianEducationLevel` pgEnum refactor (tuple + type + const alias in `@roviq/common-types`, `pgEnum` in `libs/database`, DTO import chain, migration applied via `tilt trigger db-clean`)
- [x] `[02:50 → 02:55]` Commit `a64f4a9` — `refactor(database): promote guardian education_level to pgenum from common-types`
- [x] `[02:55 → 03:00]` Write `docs/plans/enum-single-source-of-truth-migration.md` playbook
- [x] `[03:00 → 03:05]` Manual Playwright MCP: guardian create flow × 3 education levels (GRADUATE, PROFESSIONAL, NULL) — DB rows confirmed, version = 1
- [x] `[03:05 → 03:08]` SQL enforcement test: `chk_education_level` pgEnum rejects `DOCTORATE` and lowercase `graduate`, accepts valid UPPERCASE
- [x] `[03:08 → 03:12]` Hindi locale dropdown verification — all 6 options translated
- [x] `[03:12 → 03:15]` Blank submit validation error verified
- [x] `[03:15 → 03:20]` Guardian detail page bug discovery: 4 raw `<input>` elements, Zod schema string not enum, 20 missing `detail.*` i18n keys, education level free-text input instead of Select
- [x] `[03:20 → 03:25]` Dispatch 3 parallel agents: detail-page fix (`a19fd3cf`), E2E specs (`a098665a`), unit tests (`a2426ddc`)
- [x] `[03:22 → 03:25]` Earlier in the same burst: ROV-167 test-fix agent (`a2483d7c`) reported blocked on edit perms — next/navigation mock fixed inline by me instead
- [x] `[03:25 → 03:30]` Detect Turbopack build error on guardians/new client bundle: `node:async_hooks` from `common-types/lib/request-context.ts` imported through the barrel
- [x] `[03:30 → 03:45]` Create `@roviq/request-context` nx lib via generator; move `request-context.ts` + `test-utils.ts`; script-migrate 117 backend import sites; rebuild both libs; restart api-gateway; verify `ok`
- [x] `[03:45 → 03:48]` Manual Playwright MCP: navigate `/en/people/guardians/new` — build error gone, form renders
- [x] `[03:48 → 03:55]` Guardian detail page fix applied inline (agent `a19fd3cf` was blocked on edits): replaced 4 raw `<input>` with `<Input>` + `<Select>` + `Controller`; Zod schema `z.enum(GuardianEducationLevel).optional()`; 20 `detail.*` i18n keys added in en+hi
- [x] `[03:55 → 04:00]` End-to-end verification: edit guardian occupation + education level → SQL confirms persistence with version bump (1 → 2)
- [x] `[04:00 → 04:02]` Discover `UpdateGuardianInput.version` missing `@IsInt` class-validator decorator → NestJS `forbidNonWhitelisted` rejects the property. Fixed inline
- [x] `[04:02 → 04:05]` Audit all 3 people-module update DTOs for the same bug; discover `UpdateStaffInput` has ZERO class-validator decorators across all 7 fields; rewrite with full decorators
- [x] `[04:05 → 04:07]` `UpdateStudentInput` already correct; services all implement optimistic concurrency (`WHERE version = expected` + `ConflictException`) correctly
- [x] `[04:07 → 04:10]` File ROV-223 (guardian list 0 guardians), ROV-224 (Children tab read-only), ROV-225 (seed script no students/staff) — parented under ROV-169, labeled properly (Bug/Feature · User & Groups · Backend/Frontend/DevEx)
- [x] `[04:10 → 04:13]` Manual QA of student create → capture `dateOfBirth must be a valid ISO 8601 date string` BAD_REQUEST via browser fetch interceptor; diagnose dead `.or(z.literal('').transform(...))` branch in the student Zod schema
- [x] `[04:13 → 04:15]` File ROV-226 (student create silent failure), later closed in favor of inline fix per user direction
- [x] `[04:15 → 04:20]` File ROV-227 (flip legacy lowercase enums to UPPER_SNAKE) with full migration recipe
- [x] `[04:20 → 04:25]` CLAUDE.md: 4 concise enum rules + `@Field` description rule + inline revision from long paragraphs to short bullets after user feedback
- [x] `[04:25 → 04:30]` `guardian/link-guardian.input.ts` — rewrite using `GUARDIAN_RELATIONSHIP_VALUES` from `@roviq/common-types` (new), `@IsUUID()` without version arg (UUIDv7), rich `@Field` descriptions
- [x] `[04:30 → 04:32]` `guardian/list-guardians-filter.input.ts` — single field decorator + description promotion
- [x] `[04:32 → 04:35]` `staff/create-staff.input.ts` — 10 class-validator decorators with `@IsDateString`, `@IsEmail`, `@Matches(/^[6-9]\d{9}$/)`, `@IsIn` for gender
- [x] `[04:35 → 04:37]` `staff/list-staff-filter.input.ts` — 7 class-validator decorators including pagination bounds
- [x] `[03:20 → 04:38]` Dispatch 6 parallel agents across the session: DTO audit (`ad7dfd4a`, blocked), Playwright E2E specs (`a098665a`, SUCCESS 20 tests), unit tests (`a2426ddc`, SUCCESS 18/18), detail-page fix (`a19fd3cf`, blocked — done inline), 3 i18n sweep agents (`a1dd753d`, `a29d0eec`, `a91a92d4`, SUCCESS or duplicate)
- [x] `[04:38 → 04:42]` Create `.claude/sessions/<uuid>/` folder with `summary.md`, `metadata.yaml`

## In progress

- [ ] `[04:25 → …]` Guardian detail page → TanStack Form migration (react-hook-form → `@tanstack/react-form`) — agent `a3c96736` reported blocked; I'm rewriting `GuardianProfileTab` inline (imports, schema, helpers done; JSX body next)
- [ ] `[03:22 → …]` Agent `ade747bc` — student new + detail pages → TanStack Form + Zod preprocess fix (running)
- [ ] `[03:22 → …]` Agent `a3364b7e` — staff new + detail pages → TanStack Form (running, includes qualifications sub-forms)
- [ ] `[04:42 → …]` Session persistence scaffolding — create `todos.md`, `changelog.md`, `deviations.md`; add CLAUDE.md rule about session folder maintenance

## Pending

- [ ] `[… → …]` `STUDENT_DOCUMENT_TYPE_VALUES` — add to `@roviq/common-types` in `UPPER_SNAKE` per CLAUDE.md rule; co-land the `chk_document_type` column migration in the same commit so CHECK + DTO + existing rows flip atomically (no interim broken state)
- [ ] `[… → …]` `student/upload-student-document.input.ts` DTO — 5 fields, `@IsIn(STUDENT_DOCUMENT_TYPE_VALUES)` + `@IsUUID` + `@IsUrl` + `@ArrayMinSize/@ArrayMaxSize`
- [ ] `[… → …]` `student/bulk-create-students.input.ts` DTO — 5 fields
- [ ] `[… → …]` Rebuild `common-types` + `request-context` nx libs
- [ ] `[… → …]` Restart api-gateway + verify clean boot
- [ ] `[… → …]` `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` + `-p apps/api-gateway/tsconfig.app.json` — zero errors on touched files
- [ ] `[… → …]` Run guardian unit tests after TanStack migration (expect 18/18 passing after the Select assertion is updated)
- [ ] `[… → …]` Run student unit tests after TanStack migration
- [ ] `[… → …]` Run staff unit tests after TanStack migration
- [ ] `[… → …]` Re-run manual Playwright MCP guardian detail round-trip against the TanStack rewrite
- [ ] `[… → …]` `pnpm lint:fix` across all touched files
- [ ] `[… → …]` Output final `git add` + `git commit` command for the user (NO auto-commit per CLAUDE.md)
- [ ] `[… → …]` Add CLAUDE.md rule about maintaining `.claude/sessions/<uuid>/` per chat

## Open commitments (this session, nothing is deferred)

- [ ] `[… → …]` **STUDENT_DOCUMENT_TYPE_VALUES** — add to `@roviq/common-types` in `UPPER_SNAKE` (new rule mandates it), then coordinate with ROV-227 to include the `chk_document_type` column UPDATE + ALTER in the same migration so the DTO/CHECK/rows all flip atomically
- [ ] `[… → …]` Fix student list page spec OOM — investigate root cause in the heavy import tree, split the page component or mock the heavy children; same approach as the TC page OOM
- [ ] `[… → …]` Fix `apps/web/src/__test-utils__/render-with-providers.tsx` — Apollo `MockedProvider` `addTypename` prop removed in Apollo Client 4.x; use `cache: new InMemoryCache({ addTypename: false })` instead
- [ ] `[… → …]` Fix `settings/institute/components/__tests__/address-form.spec.tsx` — react-hook-form Resolver type mismatch; either update the `useForm` generic to match the Resolver's emitted type, or narrow the Resolver with `FieldValues`
- [ ] `[… → …]` Fix `guardians/__tests__/page.spec.tsx` `renders the search input` — list page no longer uses `filters.search` placeholder; update the assertion to match the current copy
- [ ] `[… → …]` Fix `CLAUDE.md` markdownlint warnings — tables with missing pipe spacing, fenced code blocks without language tags, multiple top-level H1s (downstream of line 74)
- [ ] `[… → …]` ROV-167 student test suite full fix — beyond the `next/navigation` mock bug I already patched inline
- [ ] `[… → …]` ROV-170 tc/certificates/groups test suite full fix — original agent was killed on stale base commit; start fresh against current develop

## Blocked / waiting on user

- [ ] `[… → …]` Session folder retention policy — keep forever / archive after N chats / prune after time window?
