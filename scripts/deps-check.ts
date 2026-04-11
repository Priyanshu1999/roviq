/**
 * On-demand dependency update check with a 24-hour minimum release age.
 *
 * Display-only: lists what's eligible, what's held back by the age gate, and
 * what has no registry publish time. Use `deps:update` to apply minors/patches
 * or `deps:upgrade` to drive majors through Claude Code.
 *
 * Usage:
 *   pnpm deps:check
 */
import process from 'node:process';
import { type Bucket, C, color, formatAge, getEligibility } from './lib/deps';

interface DisplayRow {
  pkg: string;
  from: string;
  to: string;
  isMajor: boolean;
  ageMs: number | null;
}

function printBucket(
  heading: string,
  rows: readonly DisplayRow[],
  pad: (s: string) => string,
): void {
  console.log(`\n${heading}`);
  for (const e of rows) {
    const tag = e.isMajor ? color(C.red, 'MAJOR ') : '      ';
    const age = e.ageMs !== null ? color(C.dim, `  (${formatAge(e.ageMs)} old)`) : '';
    console.log(
      `  ${tag}${color(C.cyan, pad(e.pkg))}  ${color(C.dim, e.from)} → ${color(C.green, e.to)}${age}`,
    );
  }
}

function printApplyHints(eligible: Bucket[]): void {
  const minors = eligible.filter((e) => !e.isMajor);
  const majors = eligible.filter((e) => e.isMajor);

  console.log('');
  if (minors.length === 0 && majors.length === 0) {
    console.log(color(C.dim, 'Nothing to apply right now.'));
    return;
  }
  if (minors.length > 0) {
    console.log(
      `${color(C.bold, 'Apply minors/patches:')} ${color(C.cyan, 'pnpm deps:update')} ${color(C.dim, `(${minors.length} eligible, one commit; halts on failure with tree preserved)`)}`,
    );
  }
  if (majors.length > 0) {
    console.log(
      `${color(C.bold, 'Upgrade majors:')}       ${color(C.cyan, 'pnpm deps:upgrade')} ${color(C.dim, `(${majors.length} eligible, one commit each, via Claude Code)`)}`,
    );
  }
}

async function main(): Promise<void> {
  console.log(color(C.dim, 'Fetching outdated packages...'));
  const { eligible, tooNew, unknown } = await getEligibility();

  if (eligible.length === 0 && tooNew.length === 0 && unknown.length === 0) {
    console.log(color(C.green, '✓ All packages up to date.'));
    return;
  }

  const longest = Math.max(...[...eligible, ...tooNew, ...unknown].map((e) => e.pkg.length));
  const pad = (s: string): string => s.padEnd(longest);

  if (eligible.length > 0) {
    printBucket(
      `${color(C.green, `✓ Eligible (${eligible.length})`)} ${color(C.dim, '— 24h+ old, 7d+ for majors')}`,
      eligible,
      pad,
    );
  }

  if (tooNew.length > 0) {
    printBucket(
      `${color(C.yellow, `⏳ Too new, wait (${tooNew.length})`)} ${color(C.dim, '— below minimum age')}`,
      tooNew,
      pad,
    );
  }

  if (unknown.length > 0) {
    printBucket(color(C.dim, `? Publish time unknown (${unknown.length})`), unknown, pad);
  }

  printApplyHints(eligible);
}

main().catch((err) => {
  console.error(color(C.red, 'Error:'), err);
  process.exit(1);
});
