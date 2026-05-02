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

## COMMENT STYLE

### [SHCMT] Short, Useful, WHY-only Comments

Comments must explain WHY, not WHAT. Add a comment only when a future reader cannot infer the reason from the code and identifier names — for example a hidden constraint, a non-obvious workaround, an invariant that must hold across calls, or behavior that would otherwise surprise the reader.

Skip the comment when the code is self-explanatory. Do not write long block comments, JSDoc paragraphs, or docstrings that restate what the code already says. Identifier names and types are the primary documentation; comments are reserved for context that does not fit there.

Anti-patterns to avoid:
- Restating the function signature in a docstring
- Tagging code with the current task or PR ("added for ROV-123", "used by X flow") — that context belongs in the commit message and rots in the source
- TODOs without an owner or removal condition
- Block comments above obvious one-liners

---

## REVIEW DISCIPLINE

### [NTLSA] No Test-Loosening Shortcuts

When a strict assertion (`toHaveBeenCalledWith({...})`, `toEqual({...})`, exact-shape matchers) fails because a mock fixture is missing a field, **fix the fixture** — never weaken the assertion to `expect.objectContaining`, `expect.any`, partial-match patterns, or by deleting fields from the expected object just to make the test pass.

The strict shape is the contract the test exists to enforce. Loosening hides regressions: a future change that drops the missing field silently passes. If a partial match is genuinely the intent (e.g. asserting only the relevant subset of an event payload), it must be a deliberate, commented choice — not a fallback because the strict assertion was inconvenient.

This rule does not forbid `expect.objectContaining` everywhere — it forbids using it as a *shortcut* in response to a failing strict assertion. Choose the strictness deliberately when writing the test, not reactively when it breaks.

---

### [NSDFR] No Skipping or Deferring Mandatory Review Items

When fixing a code review (CTO review, PR review, Linear-issue verification, audit findings), every item flagged as **mandatory / H1 / H2 / H3 / blocking / required** must be applied in this session. Never defer with phrases like "needs its own spec", "out of scope here", "follow-up issue will track this", or "will tighten later" unless the user has explicitly approved deferral in the same conversation.

Recommended / nice-to-have / M-class items may be deferred only with the user's explicit go-ahead. Default is: apply everything.

A review-fix task is not done until the diff has been audited against the original review for missed items. If a follow-up issue is genuinely needed, file the Linear issue **in the same session** and link it from the PR — don't leave a TODO.

---

### [NRTOP] Never Demote a Required Parameter to Optional

If a spec, review, or migration says a parameter / field / column / argument should be **required**, never paper over the cost of making it required by leaving it optional with `?`, `| undefined`, a default value, or a runtime fallback. The whole point of "required" is that the type system surfaces every untagged caller as a compile error so they can be fixed.

If making it required produces N TS errors, fix all N. That is the work, not the obstacle. The same applies to making a DB column `NOT NULL`, a Zod field non-`.optional()`, or a CASL ability strictly required — the strictness is the feature.

If the cost is genuinely too large for one session, escalate to the user before downgrading. Do not silently soften the contract.

---

### [NDDSN] Never Disable a Default-On Safety Net to Hide Failures

Default-on validation, schema gates, lint rules, type-strictness flags, RLS checks, runtime assertions, and CI guards exist precisely because they catch bugs the codebase has already shipped. If turning one on (or keeping it on) surfaces N broken sites, fix the N — don't revert the gate to opt-in, add an allow-list entry, or comment out the check.

Specifically: do not flip a `validate: true` default to opt-in, do not move a check from blocking to warning, do not extend an allow-list with new entries to silence existing failures, and do not wrap a failing check in `try/catch` to swallow it. If the gate is genuinely wrong, escalate to the user before disabling it.

---

### [USKLS] Use Project Skills Proactively

Invoke the matching project skill BEFORE the first Edit/Write to a file in its domain. Skills hold rules that override general assumptions and document patterns not visible in the code alone. Even if you remember the rules — the skill file is authoritative; memory drifts.

When a single change spans multiple skill domains (e.g. a new service that ships a migration and an integration test), invoke each relevant skill. Don't batch a multi-domain change without consulting each skill's rules.

---
