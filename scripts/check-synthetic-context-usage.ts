// CI guard — `mkAdminCtx` / `mkResellerCtx` / `mkInstituteCtx` are synthetic
// auth-context factories that bypass JWT scope. They are an intentional
// backdoor for code that runs without a request: Temporal workflow activities,
// seeders, repositories called from those, internal admin services, and
// integration-test fixtures. Adding any new importer is a visible PR diff
// that must be justified in review — the allowlist below is the audit trail.
//
// Why this matters: a resolver that imports `mkAdminCtx()` silently runs
// every DB call as the admin role, bypassing tenant-scope RLS. The branded
// RequestContext (Item 4) makes wrong-scope-vs-wrapper combinations a
// compile error, but `mkAdminCtx()` produces a *valid* PlatformContext
// from thin air — only this allowlist gates that backdoor.

import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const SCAN_ROOTS = [join(ROOT, 'apps'), join(ROOT, 'ee'), join(ROOT, 'libs')];

// Every file currently authorized to import a synthetic-context factory.
// See header comment. Sorted alphabetically — easier to diff in PRs.
export const SYNTHETIC_CONTEXT_ALLOWLIST: ReadonlySet<string> = new Set([
  'apps/api-gateway/src/__tests__/billing.integration.spec.ts',
  'apps/api-gateway/src/__tests__/integration-app.integration.spec.ts',
  'apps/api-gateway/src/academic-year/academic-year.service.ts',
  'apps/api-gateway/src/academic-year/repositories/academic-year.drizzle-repository.ts',
  'apps/api-gateway/src/admin/attendance/admin-attendance.service.ts',
  'apps/api-gateway/src/admin/institute/admin-institute.loaders.ts',
  'apps/api-gateway/src/admin/institute/admin-institute.service.ts',
  'apps/api-gateway/src/admin/reseller/admin-reseller.service.ts',
  'apps/api-gateway/src/admin/user/admin-user.service.ts',
  'apps/api-gateway/src/audit/repositories/audit-partition.drizzle-repository.ts',
  'apps/api-gateway/src/audit/repositories/audit-query.drizzle-repository.ts',
  'apps/api-gateway/src/audit/workflows/partition.activities.ts',
  'apps/api-gateway/src/auth/auth-event.service.ts',
  'apps/api-gateway/src/auth/identity.service.ts',
  'apps/api-gateway/src/auth/impersonation.service.ts',
  'apps/api-gateway/src/auth/middleware/impersonation-session.guard.ts',
  'apps/api-gateway/src/auth/repositories/membership.drizzle-repository.ts',
  'apps/api-gateway/src/auth/repositories/platform-membership.drizzle-repository.ts',
  'apps/api-gateway/src/auth/repositories/refresh-token.drizzle-repository.ts',
  'apps/api-gateway/src/auth/repositories/reseller-membership.drizzle-repository.ts',
  'apps/api-gateway/src/auth/repositories/user.drizzle-repository.ts',
  'apps/api-gateway/src/auth/role/__tests__/role.integration.spec.ts',
  'apps/api-gateway/src/auth/role/repositories/role.drizzle-repository.ts',
  'apps/api-gateway/src/institute-group/repositories/institute-group.drizzle-repository.ts',
  'apps/api-gateway/src/institute/admission/__tests__/application.integration.spec.ts',
  'apps/api-gateway/src/institute/admission/__tests__/enquiry.integration.spec.ts',
  'apps/api-gateway/src/institute/admission/admission.service.ts',
  'apps/api-gateway/src/institute/admission/workflows/student-admission.activities.ts',
  'apps/api-gateway/src/institute/attendance/__tests__/attendance.integration.spec.ts',
  'apps/api-gateway/src/institute/attendance/repositories/attendance.drizzle-repository.ts',
  'apps/api-gateway/src/institute/bot/bot.service.ts',
  'apps/api-gateway/src/institute/bot/repositories/bot-profile.drizzle-repository.ts',
  'apps/api-gateway/src/institute/certificate/__tests__/certificate.spec.ts',
  'apps/api-gateway/src/institute/certificate/__tests__/tc-issuance.spec.ts',
  'apps/api-gateway/src/institute/certificate/__tests__/tc.integration.spec.ts',
  'apps/api-gateway/src/institute/certificate/certificate.service.ts',
  'apps/api-gateway/src/institute/certificate/exports/awr.export.ts',
  'apps/api-gateway/src/institute/certificate/exports/cbse-loc.export.ts',
  'apps/api-gateway/src/institute/certificate/exports/cbse-registration.export.ts',
  'apps/api-gateway/src/institute/certificate/exports/rte-report.export.ts',
  'apps/api-gateway/src/institute/certificate/exports/tc-register.export.ts',
  'apps/api-gateway/src/institute/certificate/exports/udise-dcf.export.ts',
  'apps/api-gateway/src/institute/certificate/workflows/tc-issuance.activities.ts',
  'apps/api-gateway/src/institute/consent/consent.service.ts',
  'apps/api-gateway/src/institute/group/__tests__/group-rule-engine.spec.ts',
  'apps/api-gateway/src/institute/group/group-invalidation.handler.ts',
  'apps/api-gateway/src/institute/group/group.service.ts',
  'apps/api-gateway/src/institute/guardian/__tests__/guardian-link.spec.ts',
  'apps/api-gateway/src/institute/guardian/__tests__/guardian-linking.spec.ts',
  'apps/api-gateway/src/institute/guardian/guardian.service.ts',
  'apps/api-gateway/src/institute/holiday/repositories/holiday.drizzle-repository.ts',
  'apps/api-gateway/src/institute/leave/repositories/leave.drizzle-repository.ts',
  'apps/api-gateway/src/institute/management/repositories/institute.drizzle-repository.ts',
  'apps/api-gateway/src/institute/management/seed/institute-seeder.service.ts',
  'apps/api-gateway/src/institute/management/seed/institute-setup.service.ts',
  'apps/api-gateway/src/institute/section/repositories/section.drizzle-repository.ts',
  'apps/api-gateway/src/institute/setup/institute-setup.activities.ts',
  'apps/api-gateway/src/institute/staff/__tests__/staff-qualification.spec.ts',
  'apps/api-gateway/src/institute/staff/staff-qualification.service.ts',
  'apps/api-gateway/src/institute/staff/staff.service.ts',
  'apps/api-gateway/src/institute/standard/repositories/standard.drizzle-repository.ts',
  'apps/api-gateway/src/institute/student/__tests__/student-academic.service.spec.ts',
  'apps/api-gateway/src/institute/student/__tests__/student-detail.integration.spec.ts',
  'apps/api-gateway/src/institute/student/__tests__/student.service.spec.ts',
  'apps/api-gateway/src/institute/student/student-academic.service.ts',
  'apps/api-gateway/src/institute/student/student-event.handler.ts',
  'apps/api-gateway/src/institute/student/student.service.ts',
  'apps/api-gateway/src/institute/student/workflows/bulk-student-import.activities.ts',
  'apps/api-gateway/src/institute/subject/repositories/subject.drizzle-repository.ts',
  'apps/api-gateway/src/institute/user/profile.service.ts',
  'apps/api-gateway/src/notification-config/repositories/notification-config.drizzle-repository.ts',
  'apps/api-gateway/src/passkey/repositories/auth-provider.drizzle-repository.ts',
  'apps/api-gateway/src/reseller/team/reseller-team.service.ts',
  'apps/api-gateway/src/reseller/user/reseller-user.service.ts',
  'apps/notification-service/src/repositories/billing-read.drizzle-repository.ts',
  'apps/notification-service/src/repositories/notification-config-read.drizzle-repository.ts',
  'ee/apps/api-gateway/src/billing/billing-event.consumer.ts',
  'ee/apps/api-gateway/src/billing/billing.repository.ts',
  'ee/apps/api-gateway/src/billing/repositories/gateway-config.repository.ts',
  'ee/apps/api-gateway/src/billing/repositories/invoice.repository.ts',
  'ee/apps/api-gateway/src/billing/repositories/payment.repository.ts',
  'ee/apps/api-gateway/src/billing/repositories/plan.repository.ts',
  'ee/apps/api-gateway/src/billing/repositories/subscription.repository.ts',
  'ee/apps/api-gateway/src/billing/reseller/dashboard.service.ts',
  'ee/apps/api-gateway/src/billing/subscription-reader.impl.ts',
  'ee/apps/api-gateway/src/billing/workflows/billing.activities.ts',
  'ee/libs/backend/payments/src/repositories/payment-gateway-config.drizzle-repository.ts',
  'libs/backend/casl/src/repositories/membership-ability.drizzle-repository.ts',
  'libs/backend/casl/src/repositories/role.drizzle-repository.ts',
  'libs/backend/casl/src/seed-roles.ts',
  'libs/backend/testing/src/integration/data-factories.ts',
  'libs/database/src/__tests__/branded-context.spec.ts',
  'libs/database/src/index.ts',
  'libs/database/src/tenant-db.ts',
]);

const SYNTHETIC_IMPORT_RE = /\b(mkAdminCtx|mkResellerCtx|mkInstituteCtx)\b/;

interface Hit {
  relativePath: string;
}

function walk(dir: string, out: string[]): void {
  // `withFileTypes: true` returns Dirent entries — avoids a per-child
  // `statSync` and sidesteps broken symlinks crashing the walk.
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue;
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && (name.endsWith('.ts') || name.endsWith('.tsx'))) {
      out.push(full);
    }
  }
}

export function findUnauthorizedUsages(
  scanRoots: string[] = SCAN_ROOTS,
  allowlist: ReadonlySet<string> = SYNTHETIC_CONTEXT_ALLOWLIST,
  projectRoot: string = ROOT,
): Hit[] {
  const hits: Hit[] = [];
  const files: string[] = [];
  for (const root of scanRoots) walk(root, files);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!SYNTHETIC_IMPORT_RE.test(text)) continue;
    const rel = relative(projectRoot, file).replace(/\\/g, '/');
    if (allowlist.has(rel)) continue;
    hits.push({ relativePath: rel });
  }
  return hits;
}

function main(): number {
  const hits = findUnauthorizedUsages();
  if (hits.length === 0) {
    process.stdout.write(
      'check:synthetic-context-usage — every mk*Ctx importer is on the allowlist.\n',
    );
    return 0;
  }
  process.stderr.write(
    `check:synthetic-context-usage — ${hits.length} unauthorized importer(s) of synthetic auth-context factories:\n\n`,
  );
  for (const hit of hits) {
    process.stderr.write(`  ${hit.relativePath}\n`);
  }
  process.stderr.write(
    '\nmkAdminCtx / mkResellerCtx / mkInstituteCtx bypass JWT scope — they are NOT for resolvers or business services that receive an AuthUser.\n' +
      'If this importer genuinely needs synthetic auth (workflow, seeder, event consumer, repository called from one of those):\n' +
      '  1. Add the file path to SYNTHETIC_CONTEXT_ALLOWLIST in scripts/check-synthetic-context-usage.ts\n' +
      '  2. Justify the addition in the PR description (security reviewer signoff required)\n' +
      'Otherwise: refactor the caller to receive an AuthUser via the request and use assertX helpers.\n',
  );
  return 1;
}

if (process.argv[1]?.endsWith('check-synthetic-context-usage.ts')) {
  process.exit(main());
}
