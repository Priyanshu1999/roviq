# Dependency Updates

How we keep npm dependencies fresh without Renovate, a GitHub App, or any
hosted service — while still getting supply-chain safety (no packages
published <24h ago, no major bumps <7d old) and AI-assisted migration for
major versions.

## TL;DR

```bash
pnpm deps:check                    # see what's eligible
pnpm deps:update                   # apply minors/patches (one commit, auto-rollback)
pnpm deps:upgrade --only=pkg --yes # upgrade one major via Claude Code
```

All three scripts live in [scripts/](../scripts) and share logic via
[scripts/lib/deps.ts](../scripts/lib/deps.ts).

## Why not Renovate?

We tried it. Short version:

- **Renovate-as-a-bot** (hosted GitHub App) works but requires platform
  integration and puts all updates behind PRs you still have to review,
  merge, and rebase. For a fast-moving monorepo this is a lot of churn.
- **Renovate-as-a-CLI** (`--platform=local`) is explicitly meant for testing
  its own config, not for applying updates. Parsing its debug logs to drive
  `pnpm update` is fragile — fields from different packages bleed across
  records (we shipped a version of this and it reported impossible
  downgrades like `@swc/helpers: 1.15.18 → 0.5.21`).
- **Direct npm-registry queries** are simpler, faster, and always correct.
  That's what we do now.

We keep no `renovate.json`, no Renovate GitHub App, no devDependency on
Renovate. The three scripts below replace all of it.

## The three scripts

### `pnpm deps:check` — display only

Queries `pnpm outdated --format json`, then hits the npm registry in
parallel (`https://registry.npmjs.org/<pkg>`) to look up each latest
version's publish time. Buckets the results into:

| Bucket | Meaning |
|---|---|
| **Eligible** | ≥24h old (≥7d for majors). Safe to apply. |
| **Too new, wait** | Exists on npm but below the minimum age — supply-chain safety hold. |
| **Publish time unknown** | Registry didn't return a `time` entry. Rare, but we don't guess. |

Output is human-readable: colour-coded, padded columns, MAJOR tags, age
("2d old", "26h old"), and a footer that hints at the next command to run.

No side effects. Safe to run any time, even on a dirty tree.

### `pnpm deps:update` — minors + patches, one commit

Applies every **non-major** eligible update in a single commit. The contract:

1. **Refuse to run unless the git working tree is completely clean**
   (tracked *and* untracked). This makes rollback trivially
   `git reset --hard <preSha> && git clean -fd`.
2. Query eligibility, filter to `!isMajor`.
3. Validate every `<pkg>@<version>` spec against a strict regex before
   handing anything to `pnpm update`.
4. Record `preSha = HEAD`.
5. Run `pnpm update -r <spec1> <spec2> ...`
6. If the update produced no file changes, exit cleanly (nothing to commit).
7. Run, in order:
   - `pnpm lint:fix`
   - `pnpm typecheck`  (this is `nx run-many -t build`, uses NX cache)
   - `pnpm test`       (unit + integration)
8. On **any** failure → `git reset --hard preSha && git clean -fd`, exit 1.
9. On success → `git add -u && git commit -m "chore(deps): bump N packages (minor/patch)\n\n- pkgA: x → y\n- pkgB: x → y\n..."`.

**Why semver justifies batching minors/patches into one commit:** by the
semver contract, minor releases are backwards-compatible feature additions
and patch releases are backwards-compatible bug fixes. If they break your
tests, the publisher violated semver and it's on them — one commit or
sixty, the failure mode is the same. Batching is a material win for signal
density in `git log`.

**Flags:**

```bash
pnpm deps:update               # full run
pnpm deps:update --dry-run     # list what would be applied, exit (skips clean-tree gate)
pnpm deps:update --skip-tests  # apply + lint:fix + typecheck only; skip the test suite
```

Use `--skip-tests` sparingly. It exists for the case where the test suite
is known-broken for unrelated reasons and you want to land the bumps
anyway, with a follow-up `pnpm test` run by hand.

### `pnpm deps:upgrade` — majors, via Claude Code

For each eligible **major** update, we spawn a headless Claude Code session
(`claude -p "<prompt>"`) that researches the changelog, applies the bump,
migrates breaking changes, runs the test suite, and commits — or rolls
back and exits non-zero.

**Why AI for majors specifically:** minors/patches can be auto-applied
because tests are the contract. Majors require reading a changelog,
understanding what broke, and rewriting call sites. That's judgment work
that's tedious for humans but well-suited to an LLM that already has the
repo conventions loaded via `CLAUDE.md`.

**Loop shape (per package):**

1. Assert git clean.
2. `preSha = git rev-parse HEAD`.
3. Fetch the package's repo URL from `registry.npmjs.org/<pkg>`
   (`repository.url` → normalised to https).
4. Build a prompt that tells Claude:
   - What to upgrade (pkg, from, to)
   - Where to find the changelog (repo URL + context7 MCP)
   - The exact steps: research → `pnpm add` → grep usages → migrate → verify → commit
   - The commit-message format (lowercase header, ≤100 chars for commitlint)
   - Hard rules: no push, no amend, no `--no-verify`, no weakening tests, no
     proceeding past failure, no unrelated changes
5. Spawn `claude -p <prompt> --permission-mode acceptEdits --max-budget-usd <N> --output-format text` with stdio inherited so you see the session live.
6. After Claude exits:
   - Exit code non-zero → rollback to `preSha`, record failure, continue.
   - Exit 0 but `HEAD` didn't advance → rollback (if dirty), record failure.
   - Exit 0 and new commit doesn't touch `package.json`/`pnpm-lock.yaml` →
     rollback, record failure.
   - Otherwise → success, move to next package.
7. At the end, print a summary of succeeded vs. failed. Exit non-zero if
   any failed.

**Upgrade order** (sorted by `sortMajors()` in
[scripts/deps-upgrade.ts](../scripts/deps-upgrade.ts)):

1. Everything else (alphabetical)
2. `@types/*` packages
3. `typescript` — always last

Rationale: upgrading `typescript` first would trip on old `@types/*` that
haven't been bumped. Upgrading `@types/*` first gives TS the latest
definitions to type-check against. And TS itself is the widest blast
radius, so we defer it until everything else is stable.

**Flags:**

```bash
pnpm deps:upgrade                              # dry run: list majors, show changelog URLs, exit
pnpm deps:upgrade --yes                        # dispatch the full loop
pnpm deps:upgrade --only=typescript --yes      # restrict to one package
pnpm deps:upgrade --yes --budget=15            # raise per-package budget cap (default: $10)
```

The default `$10/package` cap is a safety net, not an estimate. Most
straightforward major bumps (no call-site changes) finish well under $1.
A gnarly one with lots of migration may approach the cap. Raise it with
`--budget=` if you're upgrading something invasive like React or NestJS.

## Safety invariants

Both `deps:update` and `deps:upgrade` maintain the same invariants:

| Invariant | Enforced by |
|---|---|
| Working tree clean before apply | `git status --porcelain` must be empty |
| No partial failures committed | Rollback on any step failure |
| Rollback is idempotent | `git reset --hard preSha && git clean -fd` |
| Only valid package specs run | Strict regex in `isValidSpec()` before child-process exit |
| Dry run is always safe | `--dry-run` skips the clean-tree gate and makes zero mutations |

For `deps:upgrade` specifically, we have one extra check: the new commit
must actually touch `package.json` or `pnpm-lock.yaml`. If Claude's
commit doesn't include either, we treat it as a misfire and roll back.
This catches the case where Claude commits an unrelated file change
instead of the actual upgrade.

## When to use what

| Situation | Command |
|---|---|
| Friday afternoon, want to see what's piled up | `pnpm deps:check` |
| Routine weekly bump of everything safe | `pnpm deps:update` |
| One specific major bump you want AI help with | `pnpm deps:upgrade --only=<pkg> --yes` |
| Clearing out all eligible majors | `pnpm deps:upgrade --yes` (prefer `--only` one at a time) |
| Supply-chain incident — need a bump younger than 24h | Temporarily lower `MIN_AGE_MS` in `scripts/lib/deps.ts` or do it by hand |
| CI / Renovate bot style nightly PR | **Not supported.** This is a local-only workflow by design. |

## Tuning

All knobs live in [scripts/lib/deps.ts](../scripts/lib/deps.ts):

```ts
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;        // non-major minimum
export const MAJOR_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // major minimum
```

Change them if your threat model differs. 24h / 7d is the trade-off we
picked: long enough that most supply-chain incidents have been flagged
and pulled, short enough that we're not sitting on months-old bumps.

The upgrade order weights live in `sortMajors()` in
[scripts/deps-upgrade.ts](../scripts/deps-upgrade.ts). Add more weights if
you discover another package family that needs to go last.

The Claude prompt template lives in `buildPrompt()` in the same file.
Tweak it if you find the default instructions are too loose or too rigid
for your codebase — the hard rules (no push, no amend, no weakening tests)
should stay, but the research/verify steps are fair game to adjust.

## Failure modes and how to debug them

### "Git working tree is not clean"

Expected. Commit or stash your work first. Both scripts refuse to run on
a dirty tree so that rollback is always safe. The error message lists the
offending paths.

### `pnpm update` fails

Printed live (`stdio: 'inherit'`). Usually a peer-dep conflict or a
pre-existing lockfile corruption. Script rolls back and exits 1.

### `lint:fix` / `typecheck` / `test` fails after update

The bump broke something. Script rolls back and exits 1. Options:
1. Run `pnpm deps:check` to see the list, then use `pnpm update <specific-package>@<version>` manually to bisect which bump is the culprit.
2. File an issue upstream if it's clearly a semver violation.
3. Temporarily pin the culprit in `package.json` and re-run `pnpm deps:update`.

### `claude` CLI not found

`deps:upgrade --yes` checks for `claude` on `PATH` before starting the
loop. Install Claude Code and make sure `claude --version` works.

### Claude exits 0 but nothing was committed

Script detects this (HEAD didn't advance) and treats it as a failure.
Common causes: Claude decided the upgrade was too risky mid-session, or
hit the budget cap. Re-run with a higher `--budget=` or upgrade the
package manually.

### Claude committed the wrong thing

Script detects this (new commit doesn't touch `package.json` or
`pnpm-lock.yaml`) and rolls back. If it keeps happening, the prompt
in `buildPrompt()` may need adjustment.

### 63 minors applied in one commit, one of them breaks prod a week later

You broke the rule. Semver said it was safe; the publisher lied. This
is why we have the test suite running pre-commit — if the test suite
didn't catch it, add a test that does. `git revert` the bump commit,
then pin the culprit in `package.json` and re-run `deps:update`.

## What this isn't

- **A PR-based workflow.** No bot opens PRs. Bumps land on your current
  branch. Use normal git discipline (branch off main, don't bump on
  feature branches with unrelated work).
- **A vulnerability scanner.** We don't subscribe to GHSA / Snyk feeds.
  For CVE response you want `pnpm audit` or Dependabot security alerts
  on top of this workflow.
- **A lockfile maintainer.** No equivalent of Renovate's weekly lockfile
  maintenance job. Run `pnpm install` periodically to catch lockfile
  drift.
- **Cross-repo.** Each repo has its own `scripts/deps-*.ts`. Copy the
  three scripts + the lib file to bootstrap a new repo.

## File reference

- [scripts/lib/deps.ts](../scripts/lib/deps.ts) — shared eligibility logic, types, colour helpers
- [scripts/deps-check.ts](../scripts/deps-check.ts) — display-only CLI
- [scripts/deps-update.ts](../scripts/deps-update.ts) — minors/patches apply loop
- [scripts/deps-upgrade.ts](../scripts/deps-upgrade.ts) — major upgrade loop via Claude Code
- [package.json](../package.json) — `deps:check` / `deps:update` / `deps:upgrade` scripts
