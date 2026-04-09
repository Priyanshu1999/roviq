# Hard Rules Reference — Roviq

> **SYNC RULE**: This file and `CLAUDE.md` § Hard Rules are paired.
> Any addition, removal, or edit to a rule in either file MUST be reflected in the other.
> CLAUDE.md contains concise one-liners; this file contains full detail.
> Before committing, verify both files have the same set of tags.
>
> **Lookup**: `sed -n '/\[TAGID\]/,/^---$/p' docs/references/hard-rules-reference.md`

---

## QUALITY & APPROACH

### [NWKRD] No Workarounds — Proper Fixes Only

Always find and fix root causes, never patch symptoms. If a test fails, find and fix the root cause in the implementation, not in the test. When fixing bugs or tests, ensure the fix follows the original Linear issue requirements. Never use workarounds just to make tests pass.

Scoring: +5 for every standard/proper approach, -5 for every simplest-but-not-proper fix — always choose the architecturally correct solution over a quick hack.

---

### [NACPR] No Auto Commits/Push

Output the full `git add` + `git commit` commands for the user to copy-paste. Never commit or push automatically.

Commit message format:
- Header ≤100 chars with detailed message
- Lowercase subject (no sentence/start/pascal/upper case)
- No trailing period
- Type from `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
- Blank line before body
- `BREAKING CHANGE:` footer when applicable

---

### [NDBMD] No DB Modifications Without Approval

Never execute INSERT, UPDATE, or DELETE statements without explicit user approval.

---

## LINEAR & PLANNING

### [LNFST] Linear First

Read the full Linear issue before coding — especially "Does NOT Change" and "Verification" sections. If it references a feature spec (Linear Document), read that too.

Keep Linear in sync — update issues when scope changes.

---

## RESEARCH & DOCUMENTATION

### [RSBFC] Research Before Coding — NO EXCEPTIONS

Before writing ANY code that uses a third-party library, tool, or framework:
1. Do an online web search to get the latest this-month documentation
2. Query Context7 MCP for current docs/examples

Do BOTH, every single time. Do NOT rely on training data or memory. Skipping this is a hard failure.

Your training data has outdated documentation about coding libraries. Use Context7 and online research frequently — not just before starting, but whenever you encounter unfamiliar APIs.

---

## TYPE SAFETY

### [NTESC] No Type Escape Hatches

Never put `any`, `as unknown`, or `as never` to silence type errors. Resolution order:
1. Search codebase for similar patterns
2. Use Context7 for library types
3. Do online research
4. If still not resolved, discuss with user

---

## PRE-COMMIT

### [BFCMT] Before Commit

Before committing, verify every touched code path:
1. Playwright-verify end-to-end
2. Write/update unit + component + e2e tests
3. Run `pnpm lint:fix` to fix formatting

---

### [PXERR] Pre-existing Errors Are Bugs

There is no such thing as "pre-existing errors." If you encounter them, fix and commit them separately from your feature work.

---

## CODE CONVENTIONS

### [RDPKG] Read Package.json Scripts

Before running commands related to the app, read `package.json` scripts to use the correct command. Run `pnpm lint:fix` frequently to keep formatting clean.

---

### [NPENV] Process.env Restrictions

Two restrictions:
- Do not use `process.env['FOO']` for static keys (Biome lint error)
- Do not use `process.env.FOO` until `FOO` is declared on the `ProcessEnv` interface (TypeScript error)

Use `ConfigService` in NestJS backend. See `/backend-service` skill for details.

---

### [NFEEI] Frontend Must Not Import /ee

Frontend code must never import from the `/ee` (Enterprise Edition) directory. EE code is backend-only and separately licensed.

---

## ENUM CONVENTIONS (moved to `/backend-service` skill)

Full enum rules — document every value, single source in `@roviq/common-types`, UPPER_SNAKE casing — live in the `/backend-service` skill. See that skill for the canonical pattern, playbook, and examples.

---

## GRAPHQL DECORATORS (moved to `/backend-service` skill)

Full GraphQL decorator description rules live in the `/backend-service` skill. Key rule: `@Field`, `@InputType`, `@ObjectType`, and `registerEnumType` carry `description:` when field name isn't self-explanatory.

---

## STATUS CHANGES (moved to `/backend-service` skill)

Status changes = domain mutations. Full rules (named transitions, delete vs deactivate, financial record immutability, trash/restore CASL) live in the `/backend-service` skill.

---

## UUIDv7 (moved to `/drizzle-database` skill)

UUIDv7 for all PKs. Full details live in the `/drizzle-database` skill.

---

## SESSION PERSISTENCE

### [SESPR] Session Persistence

At the start of every chat, check whether `.claude/sessions/<session-uuid>/` exists (where `<session-uuid>` is the Claude Code runtime session UUID, visible in background-task output file paths like `/tmp/claude-1000/-home-priyanshu-roviq/<uuid>/tasks/...`).

If missing, create it with 5 files:
- `summary.md` — human-readable rolling status, active agents, branch state, next actions
- `metadata.yaml` — machine-readable index (session id + slug + folder + started_at + status + initiative scope + Linear issues filed + files created/modified + agents + verified flows)
- `todos.md` — checklist mirror of `TodoWrite` state with `[HH:MM → HH:MM]` start/end timestamps per item, no `Deferred` section — everything is either Open Commitment or Blocked
- `changelog.md` — chronological `[HH:MM] type:` per-action log with types `scope|edit|commit|lib|agent|linear|verify|decision|revert|docs|rule`
- `deviations.md` — spec drifts, architectural trade-offs, user-rejected approaches, tool quirks, open questions for future sessions

Update these files regularly as work progresses — at minimum after every commit, agent dispatch, Linear issue filed, or user feedback that changes direction. Sessions may crash and recover; these files are the context restoration surface for the next-session-you. Nothing is ever "deferred" — it either lands this session or becomes an explicit open commitment tracked in `todos.md`.

---
