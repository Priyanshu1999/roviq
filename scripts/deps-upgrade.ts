/**
 * Apply eligible MAJOR dependency upgrades one at a time via Claude Code.
 *
 * For each major bump we spawn `claude -p "<prompt>"`, which researches the
 * changelog (WebFetch + context7), applies the bump, migrates breaking
 * changes, runs the test suite, and commits — or rolls back and exits
 * non-zero. After Claude exits we verify the SHA advanced and the new commit
 * touched package.json / pnpm-lock.yaml; otherwise we treat it as a misfire.
 *
 * Majors are processed sequentially — package.json and pnpm-lock.yaml would
 * conflict on parallel writes.
 *
 * Usage:
 *   pnpm deps:upgrade                → dry run: list majors + changelog URLs
 *   pnpm deps:upgrade --yes          → actually run the upgrade loop
 *   pnpm deps:upgrade --only=<pkg>   → restrict to one package
 *   pnpm deps:upgrade --budget=5     → cap each invocation at $5 (default $10)
 */
import process from 'node:process';
import {
  assertGitClean,
  type Bucket,
  C,
  color,
  fetchPackageMeta,
  getEligibility,
  git,
  normalizeRepoUrl,
  rollback,
  run,
} from './lib/deps';

const DEFAULT_BUDGET_USD = 10;

/**
 * Order upgrades so packages that cause the widest type-churn go last.
 * TypeScript itself → last. @types/* → after typescript so they pick up its
 * latest definitions.
 */
function sortMajors(majors: Bucket[]): Bucket[] {
  const weight = (pkg: string): number => {
    if (pkg === 'typescript') return 3;
    if (pkg.startsWith('@types/')) return 2;
    return 1;
  };
  return [...majors].sort((a, b) => {
    const wa = weight(a.pkg);
    const wb = weight(b.pkg);
    if (wa !== wb) return wa - wb;
    return a.pkg.localeCompare(b.pkg);
  });
}

function buildPrompt(pkg: string, from: string, to: string, repoUrl: string | null): string {
  const changelogHints = repoUrl
    ? `- ${repoUrl}/releases\n- ${repoUrl}/blob/main/CHANGELOG.md\n- ${repoUrl}/blob/master/CHANGELOG.md`
    : '- No repo URL found in npm metadata. Use WebFetch + WebSearch to find the official changelog.';

  return `You are upgrading a single npm package in the roviq pnpm monorepo. Follow these steps precisely. Do not deviate.

## Task
Upgrade \`${pkg}\` from \`${from}\` to \`${to}\` (this is a MAJOR version bump).

## Steps

1. **Research breaking changes.** Before touching any code:
   - Fetch the changelog via WebFetch. Good sources:
${changelogHints}
   - Query context7 MCP: call \`mcp__plugin_context7_context7__resolve-library-id\` with "${pkg}", then \`mcp__plugin_context7_context7__query-docs\` with a topic like "${pkg} v${to.split('.')[0]} breaking changes migration guide".
   - Read ALL changelog entries between ${from} and ${to} (not just the latest). Summarise the breaking changes in a short note.

2. **Apply the bump.** Determine whether \`${pkg}\` is a \`dependency\` or \`devDependency\` in the root \`package.json\`, then run the correct variant:
   - \`pnpm add ${pkg}@${to}\` (for dependencies)
   - \`pnpm add -D ${pkg}@${to}\` (for devDependencies)

3. **Migrate usages.** Find every import/usage of \`${pkg}\` in \`apps/\`, \`libs/\`, \`ee/\`, and \`scripts/\`. For each breaking change identified in step 1 that affects our code, apply the migration. Do NOT modify code unrelated to this upgrade.

4. **Verify.** Run in order:
   - \`pnpm lint:fix\`
   - \`pnpm typecheck\`  (this is \`nx run-many -t build\` — uses NX cache)
   - \`pnpm test\`       (unit + integration tests)

   If any step fails, fix it and re-run. If you cannot get everything green after a reasonable attempt, STOP — do NOT lower coverage, delete tests, or \`@ts-ignore\` your way out. Run \`git reset --hard HEAD && git clean -fd\` and exit with a summary of why it failed.

5. **Commit.** Stage modifications with \`git add -u\` (this catches root + workspace package.jsons + lockfile + any migrated code). Commit with this exact header format:

   \`\`\`
   chore(deps): upgrade ${pkg} ${from} → ${to}

   Breaking changes migrated:
   - <short bullet per change, or "None applicable to our codebase">

   Refs: <changelog URL you used>
   \`\`\`

   The commit header must stay under 100 chars and be all-lowercase (commitlint enforces this).

## Hard rules
- Do NOT push to a remote.
- Do NOT amend previous commits.
- Do NOT run \`git commit --no-verify\` or skip hooks.
- Do NOT modify unrelated files.
- Do NOT mock, skip, or weaken tests to get green.
- Do NOT proceed past a failing step — roll back cleanly.
- This upgrade is a standalone commit. If the working tree is already dirty when you start, STOP.

## Current state
- Node version: 24 (enforced via .nvmrc + Dockerfiles)
- Package manager: pnpm@10.33.0
- Root package.json holds all app deps; libs are pnpm workspaces under \`libs/\`
- Repo conventions live in CLAUDE.md — respect them

Begin.
`;
}

interface UpgradeResult {
  success: boolean;
  reason?: string;
}

/**
 * Build an upgrade function closed over the per-run budget. Avoids threading
 * the same value through every call.
 */
function makeUpgradeOne(budgetUsd: number): (bucket: Bucket) => Promise<UpgradeResult> {
  return async (bucket) => {
    const { pkg, from, to } = bucket;
    assertGitClean();

    const divider = color(C.bold, '═'.repeat(72));
    console.log(`\n${divider}\n${color(C.bold, `Upgrading ${pkg}: ${from} → ${to}`)}\n${divider}`);

    const preSha = git('rev-parse', 'HEAD');
    // fetchPackageMeta is memoised in lib/deps.ts — this hits the cache
    // populated during getEligibility().
    const repoUrl = normalizeRepoUrl(await fetchPackageMeta(pkg));
    const prompt = buildPrompt(pkg, from, to, repoUrl);

    console.log(color(C.dim, `Repo URL: ${repoUrl ?? '(unknown)'}`));
    console.log(color(C.dim, `Budget cap: $${budgetUsd}`));
    console.log(color(C.dim, 'Dispatching to claude -p ...\n'));

    const claude = run(
      'claude',
      [
        '-p',
        prompt,
        '--permission-mode',
        'acceptEdits',
        '--max-budget-usd',
        String(budgetUsd),
        '--output-format',
        'text',
      ],
      true,
    );

    if (claude.status !== 0) {
      rollback(preSha);
      return {
        success: false,
        reason:
          claude.status === -1
            ? '`claude` CLI not found on PATH — install Claude Code'
            : `claude exited ${claude.status}`,
      };
    }

    const postSha = git('rev-parse', 'HEAD');
    if (postSha === preSha) {
      console.error(
        color(C.yellow, '  ⚠ claude exited 0 but HEAD did not advance — no commit made'),
      );
      // claude may have left uncommitted changes — rollback is always safe.
      if (git('status', '--porcelain').length > 0) rollback(preSha);
      return { success: false, reason: 'no commit' };
    }

    // Defence in depth: the new commit MUST touch package.json or the lockfile.
    const changed = git('show', '--name-only', '--format=', postSha);
    if (!changed.includes('package.json') && !changed.includes('pnpm-lock.yaml')) {
      console.error(
        color(C.red, '  ✗ new commit does not touch package.json or pnpm-lock.yaml — rolling back'),
      );
      rollback(preSha);
      return { success: false, reason: 'commit did not touch package.json' };
    }

    console.log(color(C.green, `\n✓ ${pkg} committed as ${postSha.slice(0, 7)}`));
    return { success: true };
  };
}

function printHeader(majors: Bucket[]): void {
  console.log(color(C.bold, `\n${majors.length} eligible major upgrade(s):`));
  for (const m of majors) {
    console.log(
      `  ${color(C.red, 'MAJOR')} ${color(C.cyan, m.pkg)}  ${color(C.dim, m.from)} → ${color(C.green, m.to)}`,
    );
  }
}

function parseBudget(args: string[]): number {
  const budgetArg = args.find((a) => a.startsWith('--budget='));
  if (!budgetArg) return DEFAULT_BUDGET_USD;
  const parsed = Number.parseFloat(budgetArg.split('=')[1]);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.error(color(C.red, `✗ invalid --budget (got "${budgetArg}")`));
    process.exit(1);
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes');
  const onlyPkg = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const budgetUsd = parseBudget(args);

  if (yes) assertGitClean();

  console.log(color(C.dim, 'Fetching outdated packages...'));
  const { eligible } = await getEligibility();
  let majors = eligible.filter((e) => e.isMajor);
  if (onlyPkg) majors = majors.filter((e) => e.pkg === onlyPkg);
  majors = sortMajors(majors);

  if (majors.length === 0) {
    console.log(
      color(
        C.green,
        onlyPkg ? `✓ No eligible major upgrade for ${onlyPkg}.` : '✓ No eligible major upgrades.',
      ),
    );
    return;
  }

  printHeader(majors);

  if (!yes) {
    console.log(
      `\n${color(C.dim, 'Dry run. Pass --yes to dispatch to Claude Code.')}\n${color(C.dim, `Per-package budget cap: $${budgetUsd} (override with --budget=N)`)}\n${color(C.dim, 'Tip: start with --only=<pkg> to validate the loop on one package.')}`,
    );
    return;
  }

  const upgradeOne = makeUpgradeOne(budgetUsd);
  const results: { pkg: string; success: boolean; reason?: string }[] = [];
  for (const m of majors) {
    const r = await upgradeOne(m);
    results.push({ pkg: m.pkg, ...r });
    if (!r.success) {
      console.error(color(C.yellow, '  → continuing with next package'));
    }
  }

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n${color(C.bold, '═══ Summary ═══')}`);
  console.log(
    `${color(C.green, `✓ Succeeded (${succeeded.length})`)}: ${succeeded.map((r) => r.pkg).join(', ') || '—'}`,
  );
  if (failed.length > 0) {
    console.log(`${color(C.red, `✗ Failed (${failed.length})`)}:`);
    for (const r of failed) {
      console.log(`  ${r.pkg} — ${r.reason ?? 'unknown'}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(color(C.red, 'Error:'), err);
  process.exit(1);
});
