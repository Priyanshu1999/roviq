/**
 * Apply eligible MAJOR dependency upgrades one at a time via Claude Code.
 *
 * Each bump dispatches `claude -p` in stream-json mode; we parse the event
 * stream and pretty-print tool uses, tool results, text, and the final cost
 * summary as Claude works. After Claude exits we verify the new commit SHA
 * advanced and the commit touched package.json / pnpm-lock.yaml — otherwise
 * we treat it as a misfire and halt.
 *
 * On failure we PRESERVE the working tree (no auto-rollback). A half-done
 * major migration is valuable WIP — the human picks up from where Claude
 * left off, inspects, or manually rolls back via the printed preSha hint.
 * The loop halts on the first failure since subsequent packages would fail
 * the clean-tree gate anyway.
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
import { spawn } from 'node:child_process';
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
  printPreserveNotice,
  type RunResult,
} from './lib/deps';

const DEFAULT_BUDGET_USD = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade ordering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Order upgrades so packages that cause the widest type-churn go last.
 * TypeScript itself → last. @types/* → right before it so they pick up TS's
 * latest definitions last.
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

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(
  pkg: string,
  from: string,
  to: string,
  repoUrl: string | null,
  budgetUsd: number,
): string {
  const majorTo = to.split('.')[0];
  const changelogHints = repoUrl
    ? `- ${repoUrl}/releases\n- ${repoUrl}/blob/main/CHANGELOG.md\n- ${repoUrl}/blob/master/CHANGELOG.md`
    : '- No repo URL found in npm metadata. Use WebFetch + WebSearch to locate the official changelog.';

  return `You are upgrading ONE npm package in the roviq pnpm monorepo. You have unlimited turns within a $${budgetUsd} budget cap. The cap is a SAFETY LIMIT, not a target — use only what you need, but do not give up because "this is taking a while". Correctness is the only goal.

# Mindset

You are not finishing a task. You are making this upgrade MERGEABLE — as if a senior engineer will review it before it lands. That means:

- Every test passes. Not skipped. Not \`.todo\`. Not FIXME'd. **Passes.**
- Every type is correct. Not \`any\`. Not \`@ts-ignore\`. **Correct.**
- Every call site is migrated. Not deferred. Not TODO'd. **Migrated.**
- The diff is as clean as a hand-crafted PR from a careful developer.

If the upgrade requires rewriting 500 lines across 20 files, rewrite them. If it requires reading the new version's source in \`node_modules/${pkg}/\` to understand a breaking change, read it. If it requires 50 iterations of "test → fix → test", run them. Time spent on correctness is not waste.

# Task

Upgrade \`${pkg}\` from \`${from}\` to \`${to}\` (MAJOR version bump).

# Steps

## 1. Research — before touching any code

You need to know EVERY breaking change between ${from} and ${to}, not just the ones in the final release notes. Every minor on the way may have deprecated something.

- \`WebFetch\` the official changelog. Good sources:
${changelogHints}
- \`WebFetch\` GitHub releases page (often has more detail than CHANGELOG.md).
- Use context7 MCP: call \`mcp__plugin_context7_context7__resolve-library-id\` with \`${pkg}\`, then \`mcp__plugin_context7_context7__query-docs\` with topic \`"${pkg} v${majorTo} breaking changes migration guide"\`.
- \`WebSearch\` for \`${pkg} ${to} migration\` and \`${pkg} ${majorTo} upgrade guide\`.
- Read ALL minor changelogs between ${from} and ${to}. Not just \`${to}\`.
- If the changelog is thin, read the package's source directly (\`cat node_modules/${pkg}/dist/index.d.ts\`) to see the new API surface.
- Write down (scratchpad is fine) every breaking change that could affect our code.

## 2. Apply the bump

Determine if \`${pkg}\` is a \`dependency\` or \`devDependency\` in the root \`package.json\`:

- \`pnpm add ${pkg}@${to}\` (production dependency)
- \`pnpm add -D ${pkg}@${to}\` (dev dependency)

## 3. Find every call site

\`\`\`
grep -rn "${pkg}" --include="*.ts" --include="*.tsx" apps libs ee scripts
\`\`\`

Also grep for specific API names from the changelog that may have been renamed or removed — those often appear without importing \`${pkg}\` directly.

## 4. Migrate — every breaking change, every call site

For EVERY breaking change identified in step 1 that affects our code, apply the migration at EVERY call site. No partial migrations. No "I'll leave this for another PR". If a single breaking change cascades into 30 file changes, make all 30.

## 5. Verify — fix until green

Run these in order, fixing issues and re-running until each exits 0:

1. \`pnpm lint:fix\`
2. \`pnpm typecheck\` (this is \`nx run-many -t build\` — NX cache makes re-runs fast)
3. \`pnpm test\` (unit + integration)

When something fails:
1. Read the error carefully.
2. Understand **why** it fails — not just what line.
3. Fix the **root cause**, not the symptom.
4. Re-run.
5. Repeat. 20 iterations is fine. What is not fine is giving up.

## 6. Commit

\`git add -u\` then commit with this exact header shape (lowercase, ≤100 chars — commitlint enforces both):

\`\`\`
chore(deps): upgrade ${pkg} ${from} → ${to}

Breaking changes migrated:
- <one bullet per change; write "None applicable to our codebase" only if genuinely true>

Refs: <changelog URL you used>
\`\`\`

# Forbidden patterns — automatic rejection

You MUST NOT use any of these to "make things pass". Using any of them counts as failing the upgrade.

## Type escape hatches
- \`any\` anywhere (variables, parameters, return types, casts, annotations)
- \`as unknown\`, \`as never\`, \`as any\`
- \`@ts-ignore\`, \`@ts-expect-error\`, \`@ts-nocheck\`
- \`// biome-ignore\`, \`// eslint-disable-next-line\`, \`// eslint-disable\`
- Relaxing \`tsconfig.json\` strictness (\`strict: false\`, \`noImplicitAny: false\`, \`skipLibCheck: true\` added just for this)

## Test hacks
- \`.skip\`, \`.todo\`, \`xit\`, \`xdescribe\` on failing tests
- Deleting failing tests
- Loosening assertions to match broken behaviour
- Replacing real fixtures with stubs that hide the breakage

## Code hacks
- \`try/catch\` to swallow errors instead of fixing them
- \`if (false)\` / \`return null\` / early-return to bypass broken code paths
- Shim wrappers that paper over the new API instead of actually using it
- Pinning to an OLDER version than \`${to}\` (e.g., "let's go to 7.9 not 8.0")
- Adding \`overrides\` / \`resolutions\` in package.json to work around transitive conflicts

## Workflow hacks
- \`git commit --no-verify\` — NEVER
- \`git commit --amend\` on anything you didn't just create
- Committing with failing tests and a "TODO" in the body
- Leaving the working tree dirty and calling it success

# When you're stuck

Getting stuck on a major upgrade is expected. Do **not** give up. Escalate in this order:

1. **Re-read the error** carefully. TypeScript and test errors usually tell you exactly what's wrong.
2. **Re-read the changelog** for keywords from the error text. You probably missed something.
3. **Search GitHub issues** for the package: \`WebSearch\` \`"site:github.com ${pkg} '<exact error phrase>'"\`. Someone has hit this before.
4. **Read the new version's source** in \`node_modules/${pkg}/\` directly — see what types/methods actually exist now.
5. **Search the web verbatim** for the error message (StackOverflow, Discord, GitHub discussions).
6. **Try a minimal reproduction** — create \`/tmp/repro.ts\` that exercises just the broken pattern, get it working in isolation, then port the fix back.
7. **context7 for fresh docs** — training data may not cover the new version; context7 has current docs.
8. **Check for companion packages** — libraries often ship as core + types + tooling splits (e.g., \`@types/react\` must match \`react\`). Grep package.json for related packages that may also need bumping.

Only after **all of the above** have been genuinely exhausted do you decide the upgrade is not viable. If that happens: \`git reset --hard HEAD && git clean -fd\`, then exit with a detailed summary of every avenue you tried. Do **not** commit a half-working upgrade. Do **not** commit with \`any\` or \`@ts-ignore\` "just to ship it".

# Done criteria

You are done when **all** of these hold:

- \`pnpm lint:fix\` exits 0
- \`pnpm typecheck\` exits 0
- \`pnpm test\` exits 0
- \`git status --porcelain\` is empty (after your commit)
- Your commit's diff touches \`package.json\` + \`pnpm-lock.yaml\` and any files needed for migration
- Your diff introduces **zero** new \`any\`, \`@ts-ignore\`, \`@ts-expect-error\`, \`// biome-ignore\`, \`// eslint-disable\`, \`.skip\`, or \`TODO/FIXME/XXX\` comments
- Any test that was passing on HEAD before your work is still passing after

# Repo context

- Node 24, pnpm@10.33.0
- Root package.json holds all app deps; workspaces are \`libs/*\` and \`ee/*\`
- Hard rules at \`docs/references/hard-rules-reference.md\` — tags [NWKRD] (no workarounds) and [NTESC] (no type escape hatches) are the canonical statements of the forbidden patterns above
- Conventions at \`CLAUDE.md\` (root) — respect them
- Budget cap: $${budgetUsd} (safety limit, not target)

Begin. One goal: a clean, mergeable, correctly-migrated commit.
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude stream-json event types + renderer
// ─────────────────────────────────────────────────────────────────────────────

interface ClaudeTextBlock {
  type: 'text';
  text: string;
}
interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ClaudeToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}
interface ClaudeThinkingBlock {
  type: 'thinking';
  thinking: string;
}
type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock
  | ClaudeThinkingBlock;

interface ClaudeMessage {
  role?: 'user' | 'assistant';
  content?: string | ClaudeContentBlock[];
}

interface ClaudeEvent {
  type: string;
  subtype?: string;
  message?: ClaudeMessage;
  session_id?: string;
  model?: string;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  is_error?: boolean;
  result?: string;
}

function summariseToolInput(name: string, input: Record<string, unknown>): string {
  const str = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '');
  switch (name) {
    case 'Bash': {
      const cmd = str('command').split('\n')[0];
      return cmd ? `$ ${cmd.length > 100 ? `${cmd.slice(0, 97)}...` : cmd}` : '';
    }
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return str('file_path');
    case 'Glob':
      return str('pattern');
    case 'Grep': {
      const p = str('pattern');
      return p ? `'${p}'` : '';
    }
    case 'WebFetch':
      return str('url');
    case 'WebSearch':
      return `"${str('query')}"`;
    case 'TodoWrite': {
      const todos = input.todos;
      return Array.isArray(todos) ? `${todos.length} todo(s)` : '';
    }
    case 'Skill':
      return str('skill');
    default:
      return '';
  }
}

function extractResultText(content: ClaudeToolResultBlock['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => c.text ?? '').join(' ');
  return '';
}

function renderBlock(block: ClaudeContentBlock): void {
  if (block.type === 'text') {
    const text = block.text.trim();
    if (!text) return;
    for (const line of text.split('\n')) {
      console.log(`  ${color(C.dim, '│')} ${line}`);
    }
    return;
  }
  if (block.type === 'tool_use') {
    const summary = summariseToolInput(block.name, block.input);
    const suffix = summary ? ` ${color(C.dim, summary)}` : '';
    console.log(`  ${color(C.cyan, '▸')} ${color(C.bold, block.name)}${suffix}`);
    return;
  }
  if (block.type === 'tool_result') {
    const text = extractResultText(block.content).trim();
    if (!text) return;
    const firstLine = text.split('\n')[0].trim();
    const truncated = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
    const tag = block.is_error ? color(C.red, '    ✗') : color(C.green, '    ✓');
    console.log(`${tag} ${color(C.dim, truncated)}`);
    return;
  }
  // thinking blocks intentionally not rendered — they're noise
}

function renderEvent(evt: ClaudeEvent): void {
  // Hook events and rate-limit pings are pure noise.
  if (evt.type === 'system' && evt.subtype !== 'init') return;
  if (evt.type === 'rate_limit_event') return;

  if (evt.type === 'system' && evt.subtype === 'init') {
    const model = evt.model ?? 'claude';
    const session = evt.session_id ? ` session=${evt.session_id.slice(0, 8)}` : '';
    console.log(color(C.dim, `  ● session started — ${model}${session}`));
    return;
  }

  if (evt.type === 'assistant' || evt.type === 'user') {
    const content = evt.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) renderBlock(block);
    }
    return;
  }

  if (evt.type === 'result') {
    const cost = evt.total_cost_usd?.toFixed(4) ?? '?';
    const dur = evt.duration_ms ? `${Math.round(evt.duration_ms / 1000)}s` : '?';
    const turns = evt.num_turns ?? '?';
    const tag = evt.is_error ? color(C.red, '  ● result (error)') : color(C.dim, '  ● result');
    console.log(`${tag} ${color(C.dim, `${turns} turns, ${dur}, $${cost}`)}`);
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming claude runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn `claude` with stream-json output, parse each JSON line as it arrives,
 * and render it to the terminal in a compact form. Returns a RunResult so
 * callers can branch on the exit code like any other child_process call.
 */
function runClaudeStreaming(args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    if (!proc.stdout || !proc.stderr) {
      resolve({ status: -1, stdout: '', stderr: 'spawn produced no pipes' });
      return;
    }

    let buffer = '';
    let stderrBuf = '';
    const flushLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        renderEvent(JSON.parse(trimmed) as ClaudeEvent);
      } catch {
        // Non-JSON stdout (shouldn't happen in stream-json mode, but don't
        // silently drop it — print raw so the user at least sees it).
        console.log(color(C.dim, trimmed.length > 200 ? `${trimmed.slice(0, 200)}...` : trimmed));
      }
    };

    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        flushLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf('\n');
      }
    });

    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (chunk: string) => {
      stderrBuf += chunk;
      process.stderr.write(chunk);
    });

    proc.on('error', (err) => {
      resolve({ status: -1, stdout: '', stderr: `spawn error: ${err.message}` });
    });

    proc.on('exit', (code) => {
      if (buffer.trim()) flushLine(buffer);
      resolve({ status: code ?? -1, stdout: '', stderr: stderrBuf });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-package upgrade
// ─────────────────────────────────────────────────────────────────────────────

interface UpgradeResult {
  success: boolean;
  reason?: string;
}

/**
 * Closed over `budgetUsd` so the per-package function doesn't need to thread
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
    const prompt = buildPrompt(pkg, from, to, repoUrl, budgetUsd);

    console.log(color(C.dim, `Repo URL: ${repoUrl ?? '(unknown)'}`));
    console.log(color(C.dim, `Budget cap: $${budgetUsd}`));
    console.log(color(C.dim, 'Dispatching to claude -p (streaming)...\n'));

    const claude = await runClaudeStreaming([
      '-p',
      prompt,
      '--permission-mode',
      'acceptEdits',
      '--max-budget-usd',
      String(budgetUsd),
      '--output-format',
      'stream-json',
      '--verbose',
    ]);

    if (claude.status !== 0) {
      const reason =
        claude.status === -1
          ? '`claude` CLI not found on PATH — install Claude Code'
          : `claude exited ${claude.status}`;
      // ENOENT means claude never ran, so there's nothing to preserve.
      if (claude.status === -1) {
        console.error(color(C.red, `\n✗ ${reason}`));
      } else {
        printPreserveNotice(preSha, reason);
      }
      return { success: false, reason };
    }

    const postSha = git('rev-parse', 'HEAD');
    if (postSha === preSha) {
      printPreserveNotice(preSha, 'claude exited 0 but HEAD did not advance — no commit made');
      return { success: false, reason: 'no commit' };
    }

    // Defence in depth: the new commit MUST touch package.json or the lockfile.
    const changed = git('show', '--name-only', '--format=', postSha);
    if (!changed.includes('package.json') && !changed.includes('pnpm-lock.yaml')) {
      printPreserveNotice(
        preSha,
        'new commit does not touch package.json or pnpm-lock.yaml — likely a misfire',
      );
      return { success: false, reason: 'commit did not touch package.json' };
    }

    console.log(color(C.green, `\n✓ ${pkg} committed as ${postSha.slice(0, 7)}`));
    return { success: true };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

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
  let halted: { pkg: string; remaining: Bucket[] } | null = null;
  for (let i = 0; i < majors.length; i++) {
    const m = majors[i];
    const r = await upgradeOne(m);
    results.push({ pkg: m.pkg, ...r });
    if (!r.success) {
      // Next iteration's assertGitClean() would fail anyway, and we don't
      // want to lose Claude's partial migration work. Halt the loop and let
      // the human decide what to do.
      halted = { pkg: m.pkg, remaining: majors.slice(i + 1) };
      console.error(
        color(
          C.red,
          '\n✗ Halting upgrade loop — working tree is dirty from this package. Inspect or rollback manually before re-running.',
        ),
      );
      break;
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
  }
  if (halted && halted.remaining.length > 0) {
    console.log(
      color(
        C.yellow,
        `\n⏸ Skipped (${halted.remaining.length}, not attempted): ${halted.remaining.map((b) => b.pkg).join(', ')}`,
      ),
    );
    console.log(
      color(
        C.dim,
        `  Re-run \`pnpm deps:upgrade --yes\` after resolving the dirty state to continue with these.`,
      ),
    );
  }
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(color(C.red, 'Error:'), err);
  process.exit(1);
});
