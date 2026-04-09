# Changelog — session 5186c8e4-13d3-401c-ad4b-07a82a72b84b

> Chronological per-action log. Format: `[HH:MM]` `type:` summary. Types: `scope`, `edit`, `commit`, `lib`, `agent`, `linear`, `verify`, `defer`, `decision`, `revert`, `docs`, `rule`. All times local (IST / +05:30).

## 2026-04-09

### Scope discovery & pivot

- `[02:10]` scope: Received original task brief (ROV-167 students, ROV-169 staff/guardian/profile, ROV-170 TC/certificates/groups, massive 5-wave plan)
- `[02:15]` verify: `git log` shows ROV-167 (`4ca5d66`), ROV-169 (`8c485a5`), ROV-170 (`9c9f425`) are ALREADY committed — full Wave 2 scope is done
- `[02:20]` decision: Pivoted to verification + fixing detail-page deviations discovered during manual QA

### GuardianEducationLevel pgEnum refactor (→ commit a64f4a9)

- `[02:25]` docs: Wrote initial plan in `/home/priyanshu/.claude/plans/lively-napping-prism.md`
- `[02:28]` edit: `libs/shared/common-types/src/lib/user-profile-enums.ts` created with `GUARDIAN_EDUCATION_LEVEL_VALUES` tuple + type + const alias (single source of truth pattern)
- `[02:30]` edit: `libs/shared/common-types/src/index.ts` re-exports the new symbols
- `[02:32]` edit: `libs/database/src/schema/common/enums.ts` adds `guardianEducationLevel` pgEnum importing `GUARDIAN_EDUCATION_LEVEL_VALUES` from common-types
- `[02:35]` edit: `libs/database/src/schema/user-profiles/guardian-profiles.ts` — column type `varchar(50) + CHECK` → `guardianEducationLevel` pgEnum column
- `[02:38]` edit: `apps/api-gateway/src/institute/guardian/models/guardian.model.ts` — `registerEnumType` now uses the const alias
- `[02:42]` edit: `apps/api-gateway/src/institute/guardian/dto/{create,update}-guardian.input.ts` — imports updated
- `[02:45]` verify: `tilt trigger db-clean` applies the migration; `psql` confirms `pg_enum GuardianEducationLevel` exists with all 6 members
- `[02:50]` verify: api-gateway boots cleanly; `pnpm exec tsc --noEmit -p apps/api-gateway/tsconfig.app.json` clean
- `[02:55]` commit: `a64f4a9 refactor(database): promote guardian education_level to pgenum from common-types`
- `[02:58]` docs: Wrote `docs/plans/enum-single-source-of-truth-migration.md` — full per-enum migration playbook

### Manual Playwright MCP QA of guardian flows

- `[03:00]` verify: admin login → `saraswati-vidya-mandir` → guardian create with GRADUATE → DB row confirmed
- `[03:02]` verify: guardian create with PROFESSIONAL (Hindi locale) → DB row confirmed, all 6 dropdown options translated
- `[03:04]` verify: guardian create with NULL education level → DB row with `null` confirmed
- `[03:05]` verify: SQL `UPDATE guardian_profiles SET education_level = 'DOCTORATE'` → `invalid input value for enum` (pgEnum enforcement working)
- `[03:06]` verify: blank submit surfaces Zod "Please enter the guardian's first name" error
- `[03:08]` discovery: Guardian detail page has 4 raw `<input>` elements (CLAUDE.md @roviq/ui rule violation), free-text `educationLevel` input (not Select), `z.string().optional()` schema, entire `detail.*` i18n namespace (~20 keys) missing

### Dispatch wave 1 — agents for detail-page fix + Playwright E2E + unit tests

- `[03:20]` agent: `a19fd3cf` — fix guardian detail page 4 bugs + add 20 `detail.*` i18n keys (later: BLOCKED on edit perms)
- `[03:20]` agent: `a098665a` — write Playwright E2E specs for guardian create + detail (later: SUCCESS, 20 tests, 0 TS errors)
- `[03:20]` agent: `a2426ddc` — write Vitest unit/component tests for guardian create + detail (later: SUCCESS, 18/18 passing)

### Turbopack build error discovery → `@roviq/request-context` nx lib

- `[03:25]` discovery: Playwright MCP navigation to `/en/people/guardians/new` shows "Build Error — Code generation for chunk item errored in request-context.ts (node:async_hooks)"
- `[03:27]` investigation: Turbopack pulls the full `common-types` barrel into client bundles; the `export *` re-export of `request-context.ts` drags `node:async_hooks` into the browser bundle
- `[03:30]` attempt 1 (REVERTED): subpath alias `@roviq/common-types/request-context` in `tsconfig.base.json` + barrel cleanup + 45 backend files migrated via script → nx `NX_MAPPINGS` runtime override uses EXACT-MATCH lookup, can't resolve subpaths → api-gateway fails to boot
- `[03:40]` decision: Architectural fix — create `@roviq/request-context` as its own nx lib
- `[03:42]` lib: `pnpm nx g @nx/js:lib libs/shared/request-context --importPath=@roviq/request-context` — new nx lib scaffolded
- `[03:43]` edit: Move `request-context.ts` + `test-utils.ts` from common-types to the new lib
- `[03:44]` edit: Script-rewrite 117 backend files — replace `@roviq/common-types` imports of `getRequestContext`/`requestContext`/`RequestContext`/`withTestContext` with `@roviq/request-context`
- `[03:45]` verify: `pnpm nx build common-types` + `pnpm nx build request-context` both succeed
- `[03:46]` verify: `tilt trigger api-gateway` → runtime status `ok`
- `[03:47]` verify: Playwright MCP navigation to `/en/people/guardians/new` → form renders, no more build error

### Guardian detail page fix applied inline (agent `a19fd3cf` blocked)

- `[03:48]` edit: `apps/web/.../guardians/[id]/page.tsx` imports updated to include `Input`, `Select`, `Controller`, `GUARDIAN_EDUCATION_LEVEL_VALUES`
- `[03:50]` edit: Zod schema `educationLevel: z.string().optional()` → `z.enum(GuardianEducationLevel).optional()`
- `[03:52]` edit: 3 raw `<input>` (occupation/organization/designation) → `<Input>` from `@roviq/ui`
- `[03:53]` edit: `educationLevel` raw `<input>` → `<Controller>` + `<Select>` iterating `GUARDIAN_EDUCATION_LEVEL_VALUES`
- `[03:55]` edit: 20 `detail.*` i18n keys added in `apps/web/messages/en/guardians.json` + `hi/guardians.json` (ICU plural for `sidebar.primaryFor`, ~6 sub-namespaces)
- `[03:57]` verify: `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — zero guardian errors
- `[03:58]` verify: Manual Playwright MCP — detail page labels all render translated (no more `guardians.detail.*` literals)
- `[03:59]` verify: Education level Select opens, all 6 options translated, selecting `Post-graduate` works

### DTO decorator bug hunt (→ systemic audit)

- `[04:00]` discovery: Guardian detail save returns `BAD_REQUEST — property version should not exist` — `UpdateGuardianInput.version` has `@Field(() => Int)` but no class-validator decorator, so NestJS `ValidationPipe({ forbidNonWhitelisted: true })` rejects it
- `[04:01]` edit: `guardian/update-guardian.input.ts` — `@IsInt @Min(0)` added to `version`
- `[04:02]` verify: api-gateway reload; re-run save → DB `version` bumped 1 → 2, `occupation` persisted
- `[04:03]` discovery: `staff/update-staff.input.ts` has ZERO class-validator decorators across all 7 fields — same bug, all fields would be rejected
- `[04:04]` edit: `staff/update-staff.input.ts` — full rewrite with `@IsString`/`@IsBoolean`/`@IsInt`/`@Min`/`@MaxLength` on all fields plus module-level comment explaining the `forbidNonWhitelisted` rule
- `[04:05]` verify: `student/update-student.input.ts` already correct; all 3 services implement optimistic concurrency correctly (`WHERE version = expected` + `ConflictException`)

### Linear issues filed

- `[04:07]` linear: ROV-223 (guardian list page 0 guardians bug) — labels `Bug · User & Groups · Backend`, priority High
- `[04:09]` linear: ROV-224 (guardian detail Children tab read-only, needs Link Student) — labels `Feature · User & Groups · Frontend`, priority Medium
- `[04:11]` linear: ROV-225 (seed script creates 0 students/staff) — labels `Bug · User & Groups · DevEx`, priority High
- `[04:13]` linear: Parent ROV-223, 224, 225 under ROV-169

### Manual student create QA → `dateOfBirth` silent failure

- `[04:15]` verify: Student create form loads, all 15 seeded standards render in Class dropdown, Section dropdown enabled after Class selection
- `[04:17]` discovery: Submit fails silently (form stays on /new). Fetch interceptor captures `"dateOfBirth must be a valid ISO 8601 date string"` BAD_REQUEST
- `[04:19]` investigation: Student Zod schema has dead `.or(z.literal('').transform(() => undefined))` branch — `.string().optional()` matches `''` first, the `.or()` branch never fires
- `[04:20]` linear: ROV-226 (student create empty DOB silent failure) filed
- `[04:21]` user feedback: "don't create issues for these smaller issues, just fix them" — will close ROV-226 after inline fix
- `[04:22]` attempt: Per-field `emptyToUndef` coercion in student `onSubmit` — REJECTED by user as "workaround"
- `[04:23]` attempt: Zod-root `preprocess` wrapper on student schema — REJECTED (reason unknown, pending)
- `[04:24]` defer: Student schema fix deferred to the TanStack Form migration agent (`ade747bc`) which is already in flight and will use the Zod preprocess pattern from the guardian create page

### ROV-227: lowercase enum migration tracking

- `[04:25]` linear: ROV-227 (flip all legacy lowercase enums to UPPER_SNAKE) filed — full per-enum migration recipe referencing `docs/plans/enum-single-source-of-truth-migration.md`. Labels `Improvement · Architecture · Backend`, priority Medium

### CLAUDE.md rule additions (iterative — 3 rounds)

- `[04:25]` rule: Added long-paragraph "Single source of truth for cross-layer enums" rule
- `[04:27]` rule: Added "GraphQL @Field descriptions" rule
- `[04:30]` user feedback: "concise rules" — rewrite both as shorter bullets
- `[04:32]` rule: 4 concise bullets replace the long paragraphs: (1) document every value, (2) single source in `@roviq/common-types`, (3) `UPPER_SNAKE` mandatory, (4) `@Field` descriptions when meaningful. Legacy lowercase enums are tracked in ROV-227, no grandfather exception going forward

### DTO audit agent completes + inline application

- `[04:33]` agent: `ad7dfd4a` (DTO decorator audit) reports: audit complete, edits blocked. 6 files need fixes: `staff/create-staff.input.ts`, `staff/list-staff-filter.input.ts`, `guardian/link-guardian.input.ts`, `guardian/list-guardians-filter.input.ts`, `student/upload-student-document.input.ts`, `student/bulk-create-students.input.ts`
- `[04:35]` edit: `staff/create-staff.input.ts` — 10 class-validator decorators (`@IsIn` for gender, `@IsDateString` for DOB + joining, `@IsEmail`, `@Matches` for phone, `@MaxLength` on all strings)
- `[04:37]` edit: `staff/list-staff-filter.input.ts` — 7 decorators including pagination bounds
- `[04:38]` attempt: `guardian/link-guardian.input.ts` with `@IsUUID('4')` → REJECTED by user (UUIDv7)
- `[04:39]` attempt: With hand-listed `GUARDIAN_RELATIONSHIPS` array → REJECTED by user ("use common types as implemented previously")
- `[04:40]` edit: `@roviq/common-types` extended with `GUARDIAN_RELATIONSHIP_VALUES` + `GuardianRelationship` type + const alias (same pattern as education level)
- `[04:41]` edit: `common-types/index.ts` re-exports the new symbols
- `[04:42]` edit: `guardian/link-guardian.input.ts` — final version uses `GUARDIAN_RELATIONSHIP_VALUES`, `@IsUUID()` without version arg, rich `@Field` descriptions on every property
- `[04:43]` edit: `guardian/list-guardians-filter.input.ts` — 1 field decorated, JSDoc promoted to `@Field description:`

### TanStack Form migration dispatch

- `[04:25]` agent: `a3c96736` — guardian detail page → TanStack Form (later: BLOCKED on edit perms, I'm applying inline)
- `[04:25]` agent: `ade747bc` — student pages → TanStack Form + Zod preprocess fix (running)
- `[04:25]` agent: `a3364b7e` — staff pages → TanStack Form + qualifications sub-form (running)

### Session persistence scaffolding

- `[04:38]` edit: `.claude/sessions/2026-04-09-rov-169-people-module-pgenum-refactor/summary.md` created
- `[04:39]` edit: `metadata.yaml` created
- `[04:40]` user feedback: folder name should be the Claude session UUID, not a hand-rolled slug; todos must be checklist format with start/end timestamps
- `[04:41]` edit: Folder renamed to `5186c8e4-13d3-401c-ad4b-07a82a72b84b` (actual Claude Code session UUID from `/tmp/claude-1000/...` paths)
- `[04:42]` edit: `metadata.yaml` session.id updated + slug added as alias
- `[04:43]` edit: `todos.md` rewritten as timestamped checklist
- `[04:44]` edit: `changelog.md` created (this file)

### Guardian detail TanStack Form migration (inline, agent blocked)

- `[04:45]` edit: `guardians/[id]/page.tsx` imports — `react-hook-form` + `zodResolver` + `FormProvider` + `Controller` + `useFormDraft` + `I18nInput` + `i18nTextSchema` OUT; `@tanstack/react-form` + `AnyFieldApi` + `useStore` + `I18nInputTF` + `I18nInputTFLocaleField` + `FieldError` + `buildI18nTextSchema` + `React` IN
- `[04:47]` edit: Zod schema rewritten — `buildGuardianProfileSchema(t)` factory using `buildI18nTextSchema` for firstName/lastName with t-translated error messages, `emptyStringToUndefined` preprocess for optional strings, `z.input` type alias
- `[04:48]` edit: Added local draft helpers (`buildDraftKey`, `loadDraft`, `saveDraft`, `clearDraft`) and `firstFieldErrorMessage` per the create-page pattern — mirrors the TanStack idiom; replaces the retired `useFormDraft` hook
- `[04:50]` edit: `GuardianProfileTab` function body fully rewritten — `useForm` with `validators` + `listeners` for draft auto-save, `defaultValues` normalised to include `hi: ''` so TanStack Form can mount `firstName.hi` field cleanly even when the API returns a partial i18nText, `form.handleSubmit` via `onSubmit` config, `useStore(form.store, ...)` for `canSubmit`/`isDirty`/`isSubmitting`, native `<form>` with `e.preventDefault()` wrapper, `form.Field` render props for every scalar field, `I18nInputTF` + `I18nInputTFLocaleField` for both i18nText fields, Select still uses `GUARDIAN_EDUCATION_LEVEL_VALUES`, Save button disabled on `!canSubmit || isSubmitting || !isDirty`
- `[04:55]` verify: `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — zero errors on `guardians/[id]/page.tsx`. The 3 remaining web errors are pre-existing pending items (MockedProvider API drift + address-form Resolver mismatch)
- `[04:56]` verify: `pnpm lint:fix` on guardian detail page — clean (5 files auto-formatted including import sorting)
- `[04:57]` verify: `tilt trigger web` → runtime status `ok`
- `[04:58]` verify: Manual Playwright MCP — detail page hydrates with `firstName = Rajesh`, `occupation = Software Engineer`, `education combobox = Graduate`, Save disabled on pristine
- `[04:59]` verify: Dirty the form (`occupation → "Senior Software Engineer"`) → Save enables; `form.requestSubmit()` → DB confirms `version = 3, occupation = 'Senior Software Engineer'` (optimistic concurrency still working under TanStack Form, `version 2 → 3`)
- `[05:00]` session: Guardian detail TanStack Form migration fully landed end-to-end. Agent `a3c96736` (which was blocked on Edit perms) is now effectively superseded; its proposed test assertion update (`expect(edu).toHaveTextContent(/graduate/i)`) still applies for the unit spec when we rerun them

### Session scaffolding (`.claude/sessions/<uuid>/`)

- `[04:38]` edit: Initial folder + `summary.md`
- `[04:39]` edit: `metadata.yaml` with initiative scope + filed Linear issues + agent log
- `[04:40]` user feedback: folder must be named by Claude Code session UUID (not hand-rolled slug), todos must be checklist format with timestamps
- `[04:41]` edit: Folder renamed `2026-04-09-rov-169-people-module-pgenum-refactor` → `5186c8e4-13d3-401c-ad4b-07a82a72b84b`; metadata.yaml `session.id` updated, slug kept as alias
- `[04:43]` edit: `todos.md` rewritten as timestamped checklist
- `[04:44]` edit: `changelog.md` created
- `[04:45]` user feedback: "nothing must be deferred"
- `[04:46]` edit: `todos.md` — removed "Deferred" section, moved all pre-existing fixes into "Open commitments"; TodoWrite tool updated with 23 tracked items (zero deferred)
- `[04:48]` edit: `deviations.md` created with spec drifts, architectural deviations, Zod/TanStack/Drizzle quirks, user feedback → behavioral corrections table
- `[04:49]` user feedback: "deviations and claude.md? should I hire someone for that?" — rule hadn't been added yet
- `[04:50]` rule: CLAUDE.md session persistence rule added at line 57 — mandates `.claude/sessions/<session-uuid>/` with 5 files (`summary.md`, `metadata.yaml`, `todos.md`, `changelog.md`, `deviations.md`), regular update cadence, "nothing is deferred" language baked in
