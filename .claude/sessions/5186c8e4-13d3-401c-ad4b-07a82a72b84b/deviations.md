# Deviations — session 5186c8e4-13d3-401c-ad4b-07a82a72b84b

> Record of spec drifts, architectural deviations, blocked-by-perms agent reports, user-rejected approaches, and every non-obvious decision that would be expensive to rediscover in a future session. Kept in chronological order.

## Scope deviations from the original task brief

| Area | Spec said | What happened | Why |
|---|---|---|---|
| Waves 2 + 3 + 5 (15+ feature pages) | "build student list + detail, staff + guardian + profile + consent, TC + certificates + groups, admin + reseller pages, dashboards, demo seed, docker cleanup" | Verified all 3 Wave 2 features were ALREADY committed (`4ca5d66`, `8c485a5`, `9c9f425`). Scope pivoted to **verification + bug fixing + hardening** | The plan was stale vs. the repo state — discovered by `git log` on the first 2 mins |
| "Only work on frontend tasks" | Session-level constraint at the start | Ended up touching `libs/database`, `libs/shared/common-types`, `apps/api-gateway`, `libs/shared/request-context` (new lib) | The guardian pgEnum refactor (explicitly approved mid-session) and the Turbopack unblock required cross-layer work |

## Architectural deviations (intentional)

### 1. Split `request-context.ts` + `test-utils.ts` into their own nx lib

**Decision:** Created `libs/shared/request-context/` as `@roviq/request-context` instead of keeping the files inside `@roviq/common-types`.

**Why:** `request-context.ts` imports `node:async_hooks`. When any client component imported from `@roviq/common-types`, Turbopack walked the barrel, loaded `request-context.ts` into the client bundle, and failed with "chunking context does not support external modules" ([Next.js issue #75369](https://github.com/vercel/next.js/issues/75369)). I tried 2 lesser fixes first:

1. ❌ `"sideEffects": false` in `common-types/package.json` — user rejected as a workaround
2. ❌ Subpath alias `@roviq/common-types/request-context` via `tsconfig.base.json` paths — nx's runtime `NX_MAPPINGS` override uses EXACT string match, so subpath imports can't be resolved at runtime even though tsc accepts them. api-gateway failed to boot with `Cannot find module '@roviq/common-types/request-context'`

The nx lib split is the architecturally correct solution: separate buildable dependency → separate `NX_MAPPINGS` entry → separate dist path → clean resolution. Cost was migrating 117 backend import sites via a script; one-time pain.

### 2. Cross-layer enum single-source-of-truth via `@roviq/common-types`

**Decision:** New rule codified in CLAUDE.md — any enum used by 2+ layers (database pgEnum, api-gateway DTO, frontend Zod/Select) MUST be declared in `libs/shared/common-types/src/lib/*-enums.ts` as a `*_VALUES` tuple + type + const alias, imported by each consumer. `apps/api-gateway` never imports enum VALUES from `@roviq/database`.

**Why:** Before this session, `SubjectTypeEnum` was hand-duplicated: `subjectType` pgEnum in `libs/database/schema/common/enums.ts`, separate `export enum SubjectTypeEnum { ... }` in `apps/api-gateway/.../subject.model.ts`, and any frontend Select hand-listed the values again. Three drift points. Canonical fix applied to `GuardianEducationLevel` as the first example; playbook in `docs/plans/enum-single-source-of-truth-migration.md`.

### 3. `GuardianRelationship` + `STUDENT_DOCUMENT_TYPE_VALUES` stay lowercase for now

**Decision:** Tracked in ROV-227 for `UPPER_SNAKE` migration but not flipped in this session.

**Why:** The `student_guardian_links.relationship` and `user_documents.type` columns have existing data in lowercase (from the initial seed + manual QA). Flipping in place requires DML (`UPDATE ... SET col = UPPER(col)`) which per CLAUDE.md requires user approval and belongs in a dedicated migration. Adding them in UPPER_SNAKE without the DB flip would break existing rows at the Drizzle cast step.

**Status after user feedback:** "nothing must be deferred" — ROV-227 is now an **open commitment for this session** (not deferred). `STUDENT_DOCUMENT_TYPE_VALUES` will be added as UPPER_SNAKE and co-landed with the `chk_document_type` migration in the same commit so all three layers flip atomically.

## Spec drifts filed as Linear issues

| Issue | Kind | Summary |
|---|---|---|
| [ROV-223](https://linear.app/roviq/issue/ROV-223) | Bug | Guardian list page shows "0 guardians" when 3 rows exist in DB — suspected `innerJoin(userProfiles, ...)` without `deleted_at` filter or tenant join. Empty-state copy "Guardians are added when students are enrolled" is also misleading (guardians can be created standalone now) |
| [ROV-224](https://linear.app/roviq/issue/ROV-224) | Feature | Guardian detail "Children" tab is read-only — no Link Student / Unlink actions, copy points users back to student detail page. Backwards UX, dead-ends the stand-alone guardian create flow. Backend mutations already exist; this is frontend-only work |
| [ROV-225](https://linear.app/roviq/issue/ROV-225) | Bug | Seed script creates 0 students + 0 staff in both institutes. `SELECT count(*)` after `tilt trigger db-clean` confirms. Blocks end-to-end smoke testing of list pages, filters, bulk actions |
| [ROV-226](https://linear.app/roviq/issue/ROV-226) | Bug | Student create silently fails when DOB is blank — Zod schema has a dead `.or(z.literal('').transform(...))` branch, form sends `dateOfBirth: ""` which backend rejects with `IsDateString`. User said "fix don't file"; will close once TanStack migration lands the Zod preprocess fix |
| [ROV-227](https://linear.app/roviq/issue/ROV-227) | Improvement | Flip all legacy lowercase enums (`resellerTier`, `resellerStatus`, `GuardianRelationship`, `STUDENT_DOCUMENT_TYPE_VALUES`) to UPPER_SNAKE — includes DML for each affected column |

## Agent failures + root causes (for future session recovery)

### Blocked on Edit permissions (pattern seen in 5+ agents)

`a19fd3cf` (guardian detail fix), `a1dd753d` (guardian i18n sweep), `a2483d7c` (ROV-167 test fix), `a81224b1` (ROV-169 test fix), `a91a92d4` (student i18n), `ad7dfd4a` (DTO audit), `a3c96736` (guardian TanStack migration) all reported:

> `Edit` on `<file>` was rejected by the harness

**Suspected cause:** Subagents spawned in this session inherit the same permission scope as the parent, but the harness treats certain files as parent-owned once the parent has read/edited them. Agents then see denials on those same files. **Workaround used:** I applied the fixes inline myself after each agent reported blocked. **Long-term fix:** unknown — the permission model isn't documented visibly here.

### Stale base commit on `isolation: worktree` agents

`ad24f9cc` (ROV-170 TC frontend), `ae7592c9` (ROV-170 retry), `a180bd96` (ROV-29), `a6a6bb9a` (ROV-169) all hit the same issue: the worktree auto-generated from the `isolation: worktree` option landed on an OLDER commit than develop HEAD. `apps/web/` did not exist at that commit (pre-refactor). Agents either failed instantly or ran `git reset --hard origin/develop` (which seems to trip the harness Edit-permission system).

**Workaround:** Killed bad-base agents; relaunched without worktree isolation once I confirmed there was no file-overlap risk; applied fixes inline for the rest.

## User feedback → behavioral corrections

| When | User said | I was doing | Correction |
|---|---|---|---|
| `[02:55]` | "don't ask a single question. I have only 10 minutes" | Asking 3-option clarifying question before starting | Just picked the safest task and started |
| `[04:10]` | "you need to fix all types of tests of the given issues" | Had only done manual Playwright verification | Dispatched 3 test-fix agents + wrote specs myself |
| `[04:20]` | "don't create issues for these smaller issues, just fix them" | Had just filed ROV-226 for a small student bug | Closed the Linear-first approach; will inline-fix small bugs |
| `[04:21]` | (rejected my per-field `emptyToUndef` coercion) "why workaround?" | Adding `values.dateOfBirth \|\| undefined` per field | Read the Zod schema, found the dead `.or(z.literal(...))` branch, proposed a root `preprocess` wrapper instead |
| `[04:30]` | "if there is no rule regarding enums, analyse existing enums by reading only 2-3 files and write concise rules" | Had written a long paragraph as the new enum rule | Read 3 existing enum files, rewrote as 4 concise bullets |
| `[04:35]` | "what the fuck are you doing? use common types as we implemented previously" | Hand-listed `GUARDIAN_RELATIONSHIPS` array inside a DTO | Added `GUARDIAN_RELATIONSHIP_VALUES` to `@roviq/common-types` + imported in the DTO |
| `[04:38]` | (rejected `IsUUID('4')`) "we are using uuidv7" | Called class-validator `@IsUUID('4')` | Switched to `@IsUUID()` with no version arg (accepts any UUID version including v7) |
| `[04:41]` | "add description to @Field when meaningful" | Added some `@Field` without descriptions | Added rich `description:` to every `@Field`/`@InputType`/`@ObjectType`; codified as a new CLAUDE.md rule |
| `[04:43]` | "nothing must be deferred" | Had a "Deferred" section in todos.md with pre-existing bugs | Moved everything into active "Open commitments" section; removed `[DEFERRED]` labels |
| `[04:44]` | "session id is not correct. it should be something given by claude" | Used `2026-04-09-rov-169-people-module-pgenum-refactor` as session ID | Renamed folder to the Claude Code session UUID `5186c8e4-13d3-401c-ad4b-07a82a72b84b`, kept slug as secondary alias |
| `[04:44]` | "wrong format, they must be a checklist. start time, endtime also added" | `todos.md` was a flat bullet list without timestamps | Rewrote as checklist with `[HH:MM → HH:MM]` start/end markers |

## Zod / TanStack Form / Drizzle quirks discovered

1. **`.or(z.literal('').transform(...))` is dead code** — `.string().optional()` already accepts `''` as a valid string, so the `.or()` branch never fires. Use `z.preprocess((v) => v === '' ? undefined : v, innerSchema)` instead.
2. **next-intl 4 eagerly resolves `getRedirectFn(redirect)`** at module init during `createNavigation()`. Any Vitest mock of `next/navigation` must include `redirect: vi.fn(), permanentRedirect: vi.fn(), notFound: vi.fn(), RedirectType: { push: 'push', replace: 'replace' }` or the test file crashes at import time. Pattern applies to every spec importing `libs/frontend/i18n/src/lib/navigation.ts`.
3. **nx `NX_MAPPINGS` runtime override is exact-match**, not prefix-match. tsconfig `paths` subpath aliases work for tsc but fail at runtime. Architectural fix = separate nx lib.
4. **TanStack Form's Zod `validators.onChange` requires the schema's INPUT type** (`z.input<typeof schema>`), not the output. The create page uses `z.input<...>` explicitly; the detail page needs the same pattern.
5. **`i18nTextSchema` refines on `defaultLocale in obj`** — if the server returns `{ en: 'Foo' }` without a `hi` key and the form mounts `form.Field name="firstName.hi"`, TanStack's field value is `undefined` and the refine throws at submit. Fix: normalize defaults to `{ en: v.en ?? '', hi: v.hi ?? '' }` before passing to `useForm`.
6. **Drizzle `pgEnum` signature `<U extends string, T extends Readonly<[U, ...U[]]>>`** preserves literal-tuple type inference across module boundaries — confirmed via `node_modules/drizzle-orm/pg-core/columns/enum.d.ts:56`. Importing a `*_VALUES as const` tuple from another package works cleanly.

## Open questions carrying into future sessions

1. **Session folder retention policy** — keep forever? archive after N chats? prune after time window?
2. **Cross-session index file** — `.claude/sessions/INDEX.md` listing all past sessions with status (active/completed/abandoned) — useful?
3. **Agent edit-permission denial** — root cause + whether to file an upstream Claude Code issue or just document the workaround
4. **When to promote "legacy lowercase" enums to pgEnums** — i.e. do we also promote `chk_document_type` (17 values) and `student_guardian_links.relationship` (9 values) in the ROV-227 work, or keep them as `varchar + CHECK` and only flip the casing?
