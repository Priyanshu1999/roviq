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
const LEGACY_FILES = new Set<string>([
  'apps/web/src/app/[locale]/admin/(dashboard)/account/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/attendance/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/audit-logs/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institute-groups/new/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institute-groups/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/academic-tree.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/audit-tab.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/branding-display.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/config-display.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/setup-progress.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/_components/users-tab.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/institutes/new/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/resellers/[id]/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/resellers/new/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/resellers/page.tsx',
  'apps/web/src/app/[locale]/admin/(dashboard)/resellers/reseller-filters.tsx',
  'apps/web/src/app/[locale]/admin/login/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/academic-years/create-year-dialog.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/academic-years/edit-year-sheet.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/academic-years/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/academics/[standardId]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/academics/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/applications/approve-application-dialog.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/applications/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/applications/reject-application-dialog.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/applications/status-change-dialog.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/enquiries/convert-enquiry-dialog.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/enquiries/enquiries-kanban.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/enquiries/enquiry-form-sheet.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/enquiries/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/admission/statistics/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/attendance/history/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/attendance/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/attendance/reports/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/certificates/other/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/certificates/tc/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/certificates/tc/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/groups/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/groups/new/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/holiday/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/holiday/holiday-calendar.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/holiday/new/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/holiday/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/leave/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/leave/apply/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/leave/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/new/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/guardians/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/staff/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/staff/new/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/staff/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/students/[id]/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/people/students/new/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/profile/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/consent/page.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/institute/components/address-form.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/institute/institute-branding-tab.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/institute/institute-config-tab.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/institute/institute-info-tab.tsx',
  'apps/web/src/app/[locale]/institute/(dashboard)/settings/roles/customize-nav-sheet.tsx',
  'apps/web/src/app/[locale]/institute/login/page.tsx',
  'apps/web/src/app/[locale]/institute/select-institute/page.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/gateway-configs/page.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/invoices/record-payment-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/invoices/refund-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/plans/page.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/plans/plan-form-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/subscriptions/assign-plan-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/subscriptions/change-plan-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/subscriptions/page.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/billing/subscriptions/subscription-action-dialog.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/institutes/new/page.tsx',
  'apps/web/src/app/[locale]/reseller/(dashboard)/institutes/page.tsx',
  'apps/web/src/app/[locale]/reseller/login/page.tsx',
]);

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
