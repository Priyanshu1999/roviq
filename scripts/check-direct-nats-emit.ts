// CI guard — direct `natsClient.emit(` / `jetStreamClient.emit(` calls
// bypass `EventBusService.emit`'s typed `EventPattern` parameter.
//
// Each call site below either (a) types its argument via a private wrapper
// `emitEvent(pattern: EventPattern, ...)` and forwards to natsClient.emit
// internally, or (b) is the EventBus / nats-jetstream lib itself. Either
// is fine — the typed boundary is upheld within the file.
//
// Adding a new direct importer/caller is a visible PR diff that bypasses
// the registry typing. Add to the allowlist with a justification.

import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [join(ROOT, 'apps'), join(ROOT, 'ee'), join(ROOT, 'libs')];

// Files currently authorized to call `*Client.emit(` directly. Each is
// either the EventBus implementation, the nats-jetstream library, or a
// service/activity that types its emit boundary via a private wrapper
// `function emitEvent(pattern: EventPattern, ...)`.
export const NATS_EMIT_ALLOWLIST: ReadonlySet<string> = new Set([
  // EventBus + library internals.
  'apps/api-gateway/src/common/event-bus.service.ts',
  'libs/backend/nats-jetstream/src/streams/stream.config.ts',
  // Auth flows emitting NOTIFICATION_SUBJECTS constants directly (typed via
  // the @roviq/notifications registry, which re-exports from EVENT_PATTERNS).
  'apps/api-gateway/src/auth/auth.service.ts',
  'apps/api-gateway/src/auth/impersonation.service.ts',
  // Services with a private `emitEvent(pattern: EventPattern, ...)` wrapper.
  'apps/api-gateway/src/institute-group/institute-group.service.ts',
  'apps/api-gateway/src/institute/attendance/attendance.service.ts',
  'apps/api-gateway/src/institute/bot/bot.service.ts',
  'apps/api-gateway/src/institute/certificate/certificate.service.ts',
  'apps/api-gateway/src/institute/consent/consent.service.ts',
  'apps/api-gateway/src/institute/guardian/guardian.service.ts',
  'apps/api-gateway/src/institute/staff/staff.service.ts',
  'apps/api-gateway/src/institute/standard/standard.service.ts',
  // Temporal workflow activities — closure-scoped `function emitEvent(...)`
  // wrappers that take EventPattern.
  'apps/api-gateway/src/institute/admission/workflows/student-admission.activities.ts',
  'apps/api-gateway/src/institute/certificate/workflows/compliance-export.activities.ts',
  'apps/api-gateway/src/institute/certificate/workflows/tc-issuance.activities.ts',
  'apps/api-gateway/src/institute/setup/institute-setup.activities.ts',
  'apps/api-gateway/src/institute/student/workflows/bulk-student-import.activities.ts',
  // EE billing services with the same typed-wrapper pattern.
  'ee/apps/api-gateway/src/billing/billing.service.ts',
  'ee/apps/api-gateway/src/billing/reseller/invoice.service.ts',
  'ee/apps/api-gateway/src/billing/reseller/payment.service.ts',
  'ee/apps/api-gateway/src/billing/reseller/plan.service.ts',
  'ee/apps/api-gateway/src/billing/reseller/subscription.service.ts',
]);

// Match `natsClient.emit(` / `jetStreamClient.emit(` / `<inject-name>Client.emit(`
// outside line comments. The `^[^/]*` lookbehind-equivalent rejects matches
// that come after `//` on the same line so doc comments don't false-positive.
const NATS_EMIT_RE =
  /^(?!.*\/\/.*\b(?:natsClient|jetStreamClient)\.emit).*\b(?:natsClient|jetStreamClient)\.emit\s*\(/;

interface Hit {
  relativePath: string;
}

function walk(dir: string, out: string[]): void {
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
      // Skip spec files — direct emits in tests are mocking patterns, not prod paths.
      if (name.endsWith('.spec.ts') || name.endsWith('.integration.spec.ts')) continue;
      out.push(full);
    }
  }
}

export function findUnauthorizedDirectEmits(
  scanRoots: string[] = SCAN_ROOTS,
  allowlist: ReadonlySet<string> = NATS_EMIT_ALLOWLIST,
  projectRoot: string = ROOT,
): Hit[] {
  const hits: Hit[] = [];
  const files: string[] = [];
  for (const root of scanRoots) walk(root, files);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    const offending = lines.some((line) => NATS_EMIT_RE.test(line));
    if (!offending) continue;
    const rel = relative(projectRoot, file).replace(/\\/g, '/');
    if (allowlist.has(rel)) continue;
    hits.push({ relativePath: rel });
  }
  return hits;
}

function main(): number {
  const hits = findUnauthorizedDirectEmits();
  if (hits.length === 0) {
    process.stdout.write(
      'check:direct-nats-emit — every direct *Client.emit caller is on the allowlist.\n',
    );
    return 0;
  }
  process.stderr.write(
    `check:direct-nats-emit — ${hits.length} unauthorized direct emit caller(s):\n\n`,
  );
  for (const hit of hits) {
    process.stderr.write(`  ${hit.relativePath}\n`);
  }
  process.stderr.write(
    "\nDirect natsClient.emit / jetStreamClient.emit bypasses EventBusService.emit's typed EventPattern boundary.\n" +
      'If this caller cannot use EventBusService (e.g. it lives outside the Nest DI container — workflow activities):\n' +
      '  1. Add a private wrapper `function emitEvent(pattern: EventPattern, data: ...): void` that forwards to *Client.emit\n' +
      '  2. Add the file to NATS_EMIT_ALLOWLIST in scripts/check-direct-nats-emit.ts\n' +
      '  3. Justify the addition in the PR description\n' +
      'Otherwise: inject EventBusService and call eventBus.emit(EVENT_PATTERNS.X.y, payload).\n',
  );
  return 1;
}

if (process.argv[1]?.endsWith('check-direct-nats-emit.ts')) {
  process.exit(main());
}
