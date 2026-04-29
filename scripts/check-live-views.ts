/**
 * CI guard — fails when application code reads from a soft-deletable base
 * table instead of its `*_live` view.
 *
 * Background: every soft-deletable tenant table has a corresponding
 * `<table>_live` security_invoker view exported from `@roviq/database`.
 * Repositories and services that should hide trashed rows MUST read through
 * the view; writes (`.insert`, `.update`, `.delete`, `softDelete`) target the
 * base table.
 *
 * This script scans `apps/` and `ee/apps/` for `.from(<baseTable>)` where
 * `<baseTable>` is a known soft-deletable name. Allowed exceptions:
 *   1. The line is part of an INSERT/UPDATE/DELETE chain (write-side).
 *   2. The file lives under `**\/__tests__\/**` (mocks aren't enforced).
 *   3. The line carries a trailing `// allow-base-read: <reason>` comment.
 *   4. The file lives under `libs/database` (the schema layer itself).
 *
 * Biome doesn't support custom rules, so this is a standalone pnpm script
 * wired into the CI lint job (or run locally via `pnpm check:live-views`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

// Tables that have a corresponding `<table>Live` view. Keep in sync with
// `libs/database/src/schema/live-views.ts`.
const SOFT_DELETABLE_TABLES = [
  'academicYears',
  'admissionApplications',
  'attendanceEntries',
  'attendanceSessions',
  'botProfiles',
  'enquiries',
  'groups',
  'guardianProfiles',
  'holidays',
  'instituteAffiliations',
  'instituteBranding',
  'instituteConfigs',
  'instituteGroupBranding',
  'instituteIdentifiers',
  'institutes',
  'issuedCertificates',
  'leaves',
  'memberships',
  'roles',
  'sectionSubjects',
  'sections',
  'staffProfiles',
  'standardSubjects',
  'standards',
  'studentAcademics',
  'studentProfiles',
  'subjects',
  'tcRegister',
] as const;

const SCAN_ROOTS = [
  'apps/api-gateway/src',
  'ee/apps/api-gateway/src',
  'apps/notification-service/src',
];

interface Hit {
  file: string;
  line: number;
  text: string;
  table: string;
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (stat.isFile() && full.endsWith('.ts') && !full.endsWith('.spec.ts')) out.push(full);
  }
}

function listFiles(): string[] {
  const all: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(join(ROOT, root), all);
  }
  return all;
}

function scan(file: string): Hit[] {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('// allow-base-read')) continue;
    for (const table of SOFT_DELETABLE_TABLES) {
      // Match `.from(<table>)` — boundary check via the trailing `)` or `,`
      // avoids matching `<table>Live`. Write-side `.insert/.update/.delete`
      // calls are unaffected.
      const re = new RegExp(`\\.from\\(\\s*${table}\\s*[),]`);
      if (!re.test(line)) continue;
      hits.push({ file, line: i + 1, text: line.trim(), table });
    }
  }
  return hits;
}

function main(): number {
  const files = listFiles();
  const hits: Hit[] = [];
  for (const f of files) {
    hits.push(...scan(f));
  }
  if (hits.length === 0) {
    process.stdout.write('check:live-views — no offending base-table reads found.\n');
    return 0;
  }
  process.stderr.write(
    `check:live-views — ${hits.length} base-table read(s) found. Use the *_live view or annotate with \`// allow-base-read: <reason>\`:\n\n`,
  );
  for (const hit of hits) {
    process.stderr.write(`  ${relative(ROOT, hit.file)}:${hit.line}  .from(${hit.table})\n`);
    process.stderr.write(`    ${hit.text}\n`);
  }
  return 1;
}

process.exit(main());
