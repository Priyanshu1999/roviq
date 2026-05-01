/**
 * CI guard — fails when "registry-migrated" production files contain
 * `data-testid="<literal>"` strings.
 *
 * Why: `apps/web/src/testing/testid-registry.ts` is the single source of
 * truth for testid values shared between production code and Playwright +
 * RTL specs. Once a file is added to `MIGRATED_FILES` below, every testid
 * in it must be expressed as `data-testid={testIds.<group>.<key>}` (or a
 * builder call), not a string literal.
 *
 * Scope:
 *   - Only files explicitly listed in `MIGRATED_FILES` are policed.
 *   - `libs/frontend/ui` is intentionally exempt — its layout primitives
 *     (sidebar, bottom-tab-bar, breadcrumbs, topbar) keep stable string
 *     literals; the registry mirrors them under `testIds.layout` so e2e
 *     specs can reference everything through a single typed object.
 *   - Allowed: `data-testid={...}` (any expression), and bare `data-testid`
 *     attribute references on the registry side.
 *
 * Run via `pnpm check:testids` — pure regex, no install needed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// Source-of-truth list. Add a path here when its file is fully converted to
// the registry. Keep alphabetised within group blocks for diff stability.
const MIGRATED_FILES = [
  'apps/web/src/app/[locale]/admin/(dashboard)/dashboard/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/[id]/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/institute-columns.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/institute-filters.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/dashboard/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/students/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/roles/page.tsx',
];

// Matches `data-testid="literal"` (double-quoted string). Excludes
// `data-testid={...}` and `data-testid='literal'` (single-quoted is rare in
// JSX but not flagged here — biome's quote rule already enforces double).
const LITERAL_RE = /data-testid="[^"]+"/g;

function check(): void {
  const violations: Array<{ file: string; line: number; match: string }> = [];

  for (const rel of MIGRATED_FILES) {
    const abs = join(ROOT, rel);
    let content: string;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      console.error(`check-testid-literals: missing file in MIGRATED_FILES: ${rel}`);
      process.exit(2);
    }
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const matches = line.match(LITERAL_RE);
      if (matches) {
        for (const m of matches) {
          violations.push({ file: rel, line: idx + 1, match: m });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error('Found data-testid literals in registry-migrated files:');
    console.error('');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.match}`);
    }
    console.error('');
    console.error('Migrated files must use the typed registry:');
    console.error('    data-testid={testIds.<group>.<key>}');
    console.error('');
    console.error('See apps/web/src/testing/testid-registry.ts.');
    process.exit(1);
  }

  console.log(`OK: no testid literals in ${MIGRATED_FILES.length} migrated files.`);
}

check();
