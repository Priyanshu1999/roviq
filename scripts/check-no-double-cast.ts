// CI guard — deny `as unknown as` in hand-written TypeScript.
//
// Why: `as unknown as T` bypasses TypeScript's structural type checker entirely.
// Every occurrence is either a symptom of a type mismatch that should be fixed
// at the source (wrong return type annotation, missing .$type<>() on a jsonb
// column, un-aligned Record/Model types) or a legitimate cross-system boundary
// that should be documented explicitly. The [NTESC] hard rule bans this pattern.
//
// Exclusions (not violations):
//   - `*.generated.ts` and `__generated__/` — codegen output uses this pattern
//     intentionally for DocumentNode casts; that is a known-correct use.
//   - `node_modules/` — third-party code.
//
// Run via `pnpm check:no-double-cast`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const DOUBLE_CAST_RE = /as\s+unknown\s+as\b/g;

function isExcluded(filePath: string): boolean {
  if (filePath.includes('node_modules')) return true;
  if (filePath.includes('__generated__')) return true;
  if (filePath.endsWith('.generated.ts')) return true;
  // Skip this script itself — it mentions the pattern in comments
  if (filePath.endsWith('check-no-double-cast.ts')) return true;
  return false;
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

function scan(dir: string, violations: { file: string; line: number; text: string }[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      scan(full, violations);
    } else if ((full.endsWith('.ts') || full.endsWith('.tsx')) && !isExcluded(full)) {
      const lines = readFileSync(full, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!isCommentLine(lines[i]) && DOUBLE_CAST_RE.test(lines[i])) {
          violations.push({ file: relative(ROOT, full), line: i + 1, text: lines[i].trim() });
        }
        DOUBLE_CAST_RE.lastIndex = 0;
      }
    }
  }
}

const violations: { file: string; line: number; text: string }[] = [];
scan(ROOT, violations);

if (violations.length > 0) {
  console.error(`\n✖ check:no-double-cast — ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}\n`);
  }
  console.error(
    '  Fix: align types at the source instead of casting through unknown.\n' +
      '  See [NTESC] in CLAUDE.md. Exclusions: *.generated.ts and __generated__/.',
  );
  process.exit(1);
}

console.log(`✔ check:no-double-cast — no violations`);
