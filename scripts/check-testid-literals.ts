// CI guard — denylist `data-testid="<literal>"` under `apps/web/src` (.tsx + .ts).
//
// Why: `libs/frontend/ui/src/testing/testid-registry.ts` is the single source
// of truth for testid values shared between production code and Playwright +
// RTL specs. New code MUST express testids as `data-testid={testIds.<group>.<key>}`
// (or a builder call) so a rename in the registry surfaces as a compile
// error in every consumer at once.
//
// Gate model (deny-by-default, symmetric to `check:live-views`):
//   1. Scan every `.tsx` and `.ts` file under `apps/web/src`.
//   2. Each `data-testid="literal"` (or `'literal'`) is a violation, unless:
//        a. The file path is in `LEGACY_FILES` — pre-existing literals are
//           grandfathered. Migrate file-by-file: remove the path here once
//           every literal in the file uses the registry.
//        b. The file lives under any `__tests__` directory — test stubs may
//           use literals freely (they're not what e2e/RTL targets in
//           production).
//        c. The line carries `// allow-testid-literal: <reason>` — intentional
//           exception (rare; document the reason).
//
// Run via `pnpm check:testids` — pure regex, no install needed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOT = 'apps/web/src';

// Files with pre-existing literal testids that haven't been migrated to the
// registry yet. NEW files must NOT be added here. Migrate file-by-file:
// convert every `data-testid="…"` to `data-testid={testIds.<group>.<key>}`,
// add the keys to `libs/frontend/ui/src/testing/testid-registry.ts`, then
// remove the path from this list.
//
// Generated initial snapshot — keep alphabetised within group blocks for
// diff stability.
const LEGACY_FILES = new Set<string>([]);

// Matches `data-testid="literal"` and `data-testid='literal'`. Excludes
// `data-testid={...}` (any expression).
const LITERAL_RE = /data-testid=(?:"[^"]+"|'[^']+')/g;

interface Hit {
  file: string;
  line: number;
  match: string;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === '__tests__' || name === 'node_modules' || name === '.next' || name === 'dist') {
      continue;
    }
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts'))) {
      out.push(full);
    }
  }
}

function scan(absPath: string, rel: string): Hit[] {
  const hits: Hit[] = [];
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.includes('// allow-testid-literal')) continue;
    const matches = line.match(LITERAL_RE);
    if (!matches) continue;
    for (const m of matches) {
      hits.push({ file: rel, line: i + 1, match: m });
    }
  }
  return hits;
}

function main(): number {
  const files: string[] = [];
  walk(join(ROOT, SCAN_ROOT), files);

  const violations: Hit[] = [];
  const grandfathered: string[] = [];

  for (const abs of files) {
    const rel = relative(ROOT, abs);
    if (LEGACY_FILES.has(rel)) {
      grandfathered.push(rel);
      continue;
    }
    violations.push(...scan(abs, rel));
  }

  // Detect drift: files in LEGACY_FILES that no longer exist (or moved)
  // should fall out of the list to keep it honest.
  const seen = new Set(grandfathered);
  const stale = [...LEGACY_FILES].filter((f) => !seen.has(f));
  if (stale.length > 0) {
    process.stderr.write('check:testids — LEGACY_FILES contains paths that no longer exist:\n\n');
    for (const f of stale) process.stderr.write(`  ${f}\n`);
    process.stderr.write('\nRemove these from LEGACY_FILES.\n');
    return 1;
  }

  if (violations.length === 0) {
    process.stdout.write(
      `check:testids — clean. Scanned ${files.length} file(s); ${grandfathered.length} grandfathered.\n`,
    );
    return 0;
  }

  process.stderr.write(
    `check:testids — ${violations.length} data-testid literal(s) found in non-grandfathered files:\n\n`,
  );
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}  ${v.match}\n`);
  }
  process.stderr.write(
    '\nUse the typed registry instead:\n' +
      '    data-testid={testIds.<group>.<key>}\n' +
      '    data-testid={testIds.<group>.<builder>(id)}\n\n' +
      'Registry: libs/frontend/ui/src/testing/testid-registry.ts\n' +
      'For an intentional exception, add `// allow-testid-literal: <reason>` to the line.\n',
  );
  return 1;
}

process.exit(main());
