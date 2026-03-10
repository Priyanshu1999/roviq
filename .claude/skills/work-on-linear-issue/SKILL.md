---
name: work-on-linear-issue
description: Use when starting work on a Linear issue — provides the full workflow from understanding the issue through implementation, testing, and reporting
---

# Working on a Linear Issue

## 1. Understand
- Read the Linear issue fully — prerequisites, steps, file paths, verification, "Does NOT Change"
- If it references a feature spec (Linear Document), read that too

## 2. Verify Prerequisites
- Working tree must be clean — commit or resolve pending changes first
- `git fetch origin` then branch from `origin/main`
- Check blocking issues are completed (files/modules exist)
- `tilt get uiresources` — all resources healthy
- `pnpm install` — deps current
- If prerequisites missing → STOP, report what's missing

## 3. Implement
- Branch: `git checkout -b <linear-branch-name> origin/main`
- Follow issue's "Steps" in order, create files at exact paths specified

## 4. Test & Verify (MANDATORY before commit/PR)
- Write tests (unit: `*.spec.ts`, integration: `*.integration.test.ts`)
- Run issue's Verification commands, compare to expected output
- Run the full pre-commit gate (see Hard Rules in CLAUDE.md)
- `git diff | grep -i "school"` — zero results
- **When e2e/UI tests fail**: Use the Playwright MCP tool to debug interactively — take screenshots, inspect DOM snapshots, check console messages, and trace network requests to identify the root cause before changing code

## 5. Check Boundaries
- Re-read "Does NOT Change" — revert any accidental modifications
- `git diff --stat` — only files related to this issue

## 6. Report (DO NOT commit)
- Summarize changes, list files, show test results, note concerns
- Wait for explicit commit approval
