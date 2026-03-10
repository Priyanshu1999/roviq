---
name: fix-bug
description: Use when fixing a bug, investigating a test failure, or diagnosing unexpected behavior — provides a structured reproduce-locate-fix-verify workflow
---

# Bug Fix Workflow

## Steps

1. **Reproduce** — confirm the bug exists. Run the failing test, trigger the error, or reproduce the reported behavior.

2. **Locate** — find the relevant code. Use error messages, stack traces, and grep to narrow down.

3. **Root cause** — understand WHY it fails, not just WHERE. Read surrounding code, check recent changes (`git log -p`), trace data flow.

4. **Minimal fix** — change only what's necessary. Don't refactor, don't "improve" nearby code. Fix the bug, nothing more.

5. **Write regression test** — add a test that would have caught this bug. Name it descriptively (e.g., `it('should not allow duplicate enrollment for same student')`).

6. **Verify no regressions** — run the full pre-commit gate:
   - `pnpm run lint` — zero errors
   - `pnpm run typecheck` — zero errors
   - `pnpm run test` — all unit tests pass
   - `pnpm run e2e` — all e2e tests pass

7. **Update docs** — if the bug reveals incorrect or missing documentation (e.g., `docs/`, README, inline comments), update it alongside the fix.

8. **Report** — summarize root cause, fix, and test added. Wait for commit approval.
