/**
 * Apply all eligible minor + patch dependency updates in one commit.
 *
 * Semver contract: minors and patches are backwards-compatible, so it's safe
 * to batch them. If a bump breaks tests, the publisher violated semver — one
 * commit or sixty, the failure mode is the same. Batching keeps `git log`
 * dense.
 *
 * On failure at any step we STOP and preserve the working tree as-is so the
 * partial bump + any lint:fix edits are available for inspection/bisection.
 * The original HEAD SHA is printed in case the user wants to rollback manually.
 *
 * Usage:
 *   pnpm deps:update              → apply + run full test suite
 *   pnpm deps:update --skip-tests → apply + typecheck only (use at own risk)
 *   pnpm deps:update --dry-run    → show what would be applied, then exit
 */
import process from 'node:process';
import {
  assertGitClean,
  type Bucket,
  C,
  color,
  getEligibility,
  git,
  isValidSpec,
  printPreserveNotice,
  run,
} from './lib/deps';

function buildCommitMessage(minors: Bucket[]): string {
  const header = `chore(deps): bump ${minors.length} packages (minor/patch)`;
  const body = minors.map((m) => `- ${m.pkg}: ${m.from} → ${m.to}`).join('\n');
  return `${header}\n\n${body}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');

  if (!dryRun) assertGitClean();

  console.log(color(C.dim, 'Fetching outdated packages...'));
  const { eligible } = await getEligibility();
  const minors = eligible.filter((e) => !e.isMajor);

  if (minors.length === 0) {
    console.log(color(C.green, '✓ No eligible minor/patch updates.'));
    return;
  }

  console.log(`\n${color(C.bold, `${minors.length} minor/patch updates eligible:`)}`);
  for (const m of minors) {
    console.log(`  ${color(C.cyan, m.pkg)}  ${color(C.dim, m.from)} → ${color(C.green, m.to)}`);
  }

  if (dryRun) {
    console.log(color(C.dim, '\nDry run. Nothing applied.'));
    return;
  }

  const specs = minors.map((m) => `${m.pkg}@${m.to}`);
  const invalid = specs.filter((s) => !isValidSpec(s));
  if (invalid.length > 0) {
    console.error(color(C.red, `Refusing to apply — invalid specs:\n  ${invalid.join('\n  ')}`));
    process.exit(1);
  }

  const preSha = git('rev-parse', 'HEAD');

  // Close preSha so step runners don't have to thread it through every call.
  // On failure: preserve the tree (no auto-rollback), print the preSha hint,
  // and exit 1 so the user can inspect or bisect.
  const runStep = (label: string, cmd: string, cmdArgs: string[]): void => {
    console.log(
      `\n${color(C.bold, `› ${label}`)} ${color(C.dim, `(${cmd} ${cmdArgs.join(' ')})`)}`,
    );
    const r = run(cmd, cmdArgs, true);
    if (r.status !== 0) {
      printPreserveNotice(preSha, `${label} failed (exit ${r.status})`);
      process.exit(1);
    }
  };

  runStep('pnpm update', 'pnpm', ['update', '-r', ...specs]);

  if (git('status', '--porcelain').length === 0) {
    console.log(color(C.yellow, '\n⚠ pnpm update produced no changes — nothing to commit.'));
    return;
  }

  runStep('lint:fix', 'pnpm', ['lint:fix']);
  runStep('typecheck', 'pnpm', ['typecheck']);
  if (skipTests) {
    console.log(color(C.yellow, '\n⚠ Skipping tests (--skip-tests)'));
  } else {
    runStep('test', 'pnpm', ['test']);
  }

  // lint:fix may have written files — re-stage everything before committing.
  console.log(`\n${color(C.bold, '› commit')}`);
  run('git', ['add', '-u']);
  const commit = run('git', ['commit', '-m', buildCommitMessage(minors)], true);
  if (commit.status !== 0) {
    printPreserveNotice(preSha, 'git commit failed');
    process.exit(1);
  }

  const newSha = git('rev-parse', 'HEAD');
  console.log(
    `\n${color(C.green, `✓ Done. ${minors.length} packages bumped in ${newSha.slice(0, 7)}.`)}`,
  );
}

main().catch((err) => {
  console.error(color(C.red, 'Error:'), err);
  process.exit(1);
});
