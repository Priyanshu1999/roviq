/**
 * CI guard — every soft-deletable pgTable must have a corresponding `<table>Live`
 * view exported from the matching `live-views.ts`.
 *
 * Soft-deletable = spreads `tenantColumns` / `entityColumns`, or declares an
 * explicit `deletedAt:` column. Without a `<table>Live` view, application
 * code is forced to either (a) read the base table directly (defeating the
 * `*_live` convention enforced by `pnpm check:live-views`) or (b) sprinkle
 * `isNull(deletedAt)` filters per call site.
 *
 * Companion to `scripts/check-live-views.ts` — that script catches reads of
 * the base table from app code; this one catches gaps in the schema layer
 * (missing view exports).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
export const SCHEMA_ROOT = join(ROOT, 'libs/database/src/schema');
export const LIVE_VIEWS_FILE = join(SCHEMA_ROOT, 'live-views.ts');
export const EE_SCHEMA_ROOT = join(ROOT, 'ee/libs/database/src/schema');
export const EE_LIVE_VIEWS_FILE = join(EE_SCHEMA_ROOT, 'billing/live-views.ts');

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', 'common']);
const SKIP_BASENAMES = new Set([
  'live-views.ts',
  'index.ts',
  'relations.ts',
  'enums.ts',
  'helpers.ts',
  'types.ts',
  'validators.ts',
  'columns.ts',
  'rls-policies.ts',
]);

export function isSoftDeletable(text: string): boolean {
  return (
    text.includes('tenantColumns') || text.includes('entityColumns') || /\bdeletedAt\s*:/.test(text)
  );
}

export function extractTableNames(text: string): string[] {
  const names: string[] = [];
  const re = /export\s+const\s+(\w+)\s*=\s*pgTable/g;
  for (const m of text.matchAll(re)) {
    names.push(m[1]);
  }
  return names;
}

export function loadLiveViewExports(filePath: string): Set<string> {
  const out = new Set<string>();
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return out;
  }
  const re = /export\s+const\s+(\w+Live)\s*=/g;
  for (const m of text.matchAll(re)) {
    out.add(m[1]);
  }
  return out;
}

export interface Gap {
  file: string;
  tableName: string;
  expectedExport: string;
  liveViewsFile: string;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (
      stat.isFile() &&
      full.endsWith('.ts') &&
      !full.endsWith('.spec.ts') &&
      !SKIP_BASENAMES.has(name)
    ) {
      out.push(full);
    }
  }
}

export function findGaps(schemaRoot: string, liveViewsFile: string): Gap[] {
  const liveExports = loadLiveViewExports(liveViewsFile);
  const files: string[] = [];
  walk(schemaRoot, files);
  const gaps: Gap[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!isSoftDeletable(text)) continue;
    const tables = extractTableNames(text);
    for (const tableName of tables) {
      const expectedExport = `${tableName}Live`;
      if (!liveExports.has(expectedExport)) {
        gaps.push({ file, tableName, expectedExport, liveViewsFile });
      }
    }
  }
  return gaps;
}

function main(): number {
  const gaps: Gap[] = [
    ...findGaps(SCHEMA_ROOT, LIVE_VIEWS_FILE),
    ...findGaps(EE_SCHEMA_ROOT, EE_LIVE_VIEWS_FILE),
  ];
  if (gaps.length === 0) {
    process.stdout.write(
      'check:live-views-coverage — every soft-deletable table has a *Live view.\n',
    );
    return 0;
  }
  process.stderr.write(
    `check:live-views-coverage — ${gaps.length} soft-deletable table(s) missing a *Live view:\n\n`,
  );
  for (const gap of gaps) {
    process.stderr.write(
      `  ${relative(ROOT, gap.file)}\n    table:    ${gap.tableName}\n    expected: export const ${gap.expectedExport}\n    in:       ${relative(ROOT, gap.liveViewsFile)}\n\n`,
    );
  }
  return 1;
}

// Only run main() when invoked as a script (not when imported by tests).
if (process.argv[1]?.endsWith('check-live-views-coverage.ts')) {
  process.exit(main());
}
