# Agent Workflow

## Runtime Verification

Compilation passing does NOT mean it works. After any change to:

- NX project.json, tsconfig, path aliases, module resolution, or imports
- Docker compose, infra configs, or environment variables
- New library scaffolding or cross-project wiring

**You MUST run the actual app** (`tilt trigger api-gateway` and check `tilt logs api-gateway`) and verify it starts without runtime errors. Fix iteratively until the app runs clean — do not wait for the user to tell you.

## Phase Completion — Bug-Free Gate

After completing each phase/issue implementation:

1. **Run tests**: `pnpm test` — fix any failures iteratively until all pass
2. **Run lint**: `pnpm lint:fix` — fix any errors
3. **Run typecheck**: `pnpm exec tsc --noEmit` if touching TypeScript
4. **Write/update tests**: Every new code path must have tests before moving on
5. **Write/update docs**: Update relevant docs in the same batch
6. **Re-read the original Linear issue + comments**: Verify you haven't deviated from or forgotten any requirement. Cross-check every spec item against your implementation before declaring done.
7. **Fix iteratively**: If anything fails, fix and re-run until clean. Do NOT move to the next phase with known failures.

## Before you say that you have completed something

- You must create/update tests related to it
- You must run `pnpm test`
- You must create/update docs related to it
- You must re-read the original issue to confirm no deviation or missed requirement

## Post-Implementation (do proactively)

- **RLS audit**: When changing models, verify and report RLS status for every affected table
- **New tests**: Proactively write tests for new code paths, report coverage gaps
- **Documentation**: Update docs in the same batch as the implementation
