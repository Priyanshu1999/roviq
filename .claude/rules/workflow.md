# Agent Workflow

## Working on a Linear Issue

### 1. Understand
- Read the Linear issue fully — prerequisites, steps, file paths, verification, "Does NOT Change"
- If it references a feature spec (Linear Document), read that too

### 2. Verify Prerequisites
- Working tree must be clean — commit or resolve pending changes first
- `git fetch origin` then branch from `origin/main`
- Check blocking issues are completed (files/modules exist)
- `tilt get uiresources` — all resources healthy
- `pnpm install` — deps current
- If prerequisites missing → STOP, report what's missing

### 3. Implement
- Branch: `git checkout -b <linear-branch-name> origin/main`
- Follow issue's "Steps" in order, create files at exact paths specified

### 4. Test & Verify (MANDATORY before commit/PR)
- Write tests (unit: `*.spec.ts`, integration: `*.integration.test.ts`)
- Run issue's Verification commands, compare to expected output
- Run the full pre-commit gate (see Hard Rules in CLAUDE.md)
- `git diff | grep -i "school"` — zero results
- **When e2e/UI tests fail**: Use the Playwright MCP tool to debug interactively — take screenshots, inspect DOM snapshots, check console messages, and trace network requests to identify the root cause before changing code

### 5. Check Boundaries
- Re-read "Does NOT Change" — revert any accidental modifications
- `git diff --stat` — only files related to this issue

### 6. Report (DO NOT commit)
- Summarize changes, list files, show test results, note concerns
- Wait for explicit commit approval

## Implementation Self-Check

Run through this while coding:
- [ ] `TenantPrismaClient` for tenant-scoped data, not raw `PrismaClient`?
- [ ] `adminPrisma` only for platform-level entities (User, auth)?
- [ ] `tenantTransaction`, not `$transaction`?
- [ ] New tenant-scoped model has `tenantId` + `@@index` + `@@map` + RLS migration?
- [ ] CASL checks, not role string comparisons?
- [ ] `publish()` from `@roviq/nats-utils`, not raw `js.publish()`?
- [ ] Zero occurrences of "school"?
- [ ] Schema changed? → `scripts/seed.ts`, `e2e/`, test files updated?
- [ ] Only exporting what's externally needed?
- [ ] All user-facing strings use `useTranslations()`, not hardcoded?
- [ ] New feature has translation namespace in `messages/{locale}/`?
- [ ] `ConfigService`, not `process.env` in NestJS?
- [ ] New env var added to `.env.example` too?

## Post-Implementation (do proactively)

- **RLS audit**: When changing models, verify and report RLS status for every affected table
- **New tests**: Proactively write tests for new code paths, report coverage gaps
- **Documentation**: Update docs in the same batch as the implementation

## Bug Fix Variant

Reproduce → Locate → Root cause → Minimal fix → Write regression test → Verify no regressions → Report
