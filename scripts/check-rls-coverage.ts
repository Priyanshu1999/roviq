/**
 * CI guard — every pgTable definition must opt into RLS (or be on the
 * exempt list of platform-level user tables whose access is governed by
 * DB-role GRANTs + CASL rather than per-row RLS).
 *
 * Detects RLS via any of: `tenantPolicies(`, `tenantPoliciesSimple(`,
 * `entityPolicies(`, `immutableEntityPolicies(`, `pgPolicy(`, `.enableRLS()`.
 *
 * Companion to `scripts/check-live-views-coverage.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const ROOT = process.cwd();
export const SCHEMA_ROOT = join(ROOT, 'libs/database/src/schema');
export const EE_SCHEMA_ROOT = join(ROOT, 'ee/libs/database/src/schema');

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

/**
 * Platform-level user tables whose access is enforced by DB-role GRANTs
 * (only `roviq_admin` / `roviq_reseller` connect; `roviq_app` is denied at
 * the GRANT layer) plus CASL at the resolver layer. They intentionally do
 * not carry per-row RLS.
 */
export const RLS_EXEMPT_BASENAMES = new Set([
  'user-profiles.ts',
  'user-documents.ts',
  'user-addresses.ts',
  'user-identifiers.ts',
  'auth-providers.ts',
  'phone-numbers.ts',
  'group-memberships.ts',
]);

const RLS_INDICATORS = [
  'tenantPolicies(',
  'tenantPoliciesSimple(',
  'entityPolicies(',
  'immutableEntityPolicies(',
  'pgPolicy(',
  '.enableRLS()',
];

export function hasPgTable(text: string): boolean {
  return /\bpgTable\s*\(/.test(text);
}

export function hasRls(text: string): boolean {
  return RLS_INDICATORS.some((needle) => text.includes(needle));
}

export interface Missing {
  file: string;
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

export function findMissingRls(schemaRoot: string): Missing[] {
  const files: string[] = [];
  walk(schemaRoot, files);
  const missing: Missing[] = [];
  for (const file of files) {
    if (RLS_EXEMPT_BASENAMES.has(basename(file))) continue;
    const text = readFileSync(file, 'utf8');
    if (!hasPgTable(text)) continue;
    if (!hasRls(text)) missing.push({ file });
  }
  return missing;
}

function main(): number {
  const missing = [...findMissingRls(SCHEMA_ROOT), ...findMissingRls(EE_SCHEMA_ROOT)];
  if (missing.length === 0) {
    process.stdout.write('check:rls-coverage — every non-exempt pgTable opts into RLS.\n');
    return 0;
  }
  process.stderr.write(
    `check:rls-coverage — ${missing.length} pgTable(s) missing RLS policies. Add tenantPolicies()/entityPolicies()/pgPolicy() + .enableRLS(), or add the file to RLS_EXEMPT_BASENAMES with a justification:\n\n`,
  );
  for (const m of missing) {
    process.stderr.write(`  ${relative(ROOT, m.file)}\n`);
  }
  return 1;
}

// Only run main() when invoked as a script (not when imported by tests).
if (process.argv[1]?.endsWith('check-rls-coverage.ts')) {
  process.exit(main());
}
