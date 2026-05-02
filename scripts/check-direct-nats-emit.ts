// CI guard — direct `natsClient.emit(` / `jetStreamClient.emit(` / `client.emit(`
// calls bypass `EventBusService.emit`'s typed `EventPattern` parameter, default-on
// Zod validation, OpenTelemetry metrics, and GraphQL pubsub fanout.
//
// Legitimate exceptions (allowlist):
//   (a) The EventBus / nats-jetstream lib internals themselves.
//   (b) Temporal workflow activities — they run outside the Nest DI container
//       and so cannot inject EventBusService. They MUST type their argument via a
//       closure-scoped `function emitEvent(pattern: EventPattern, ...)` that
//       forwards to natsClient.emit, preserving the typed boundary.
//
// Any other direct emit must route through `EventBusService.emit(...)` so that
// every emit site is uniformly validated, metered, and fan-routed to GraphQL.
// Adding a new allowlist entry is a visible PR diff that requires justification.
//
// Detects direct emit calls on injected NATS-like ClientProxy (`natsClient`,
// `jetStreamClient`, or `client`). Allowlist entries must justify why they
// cannot route through `EventBusService`.

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
  // Temporal workflow activities — closure-scoped `function emitEvent(...)`
  // wrappers that take EventPattern.
  'apps/api-gateway/src/institute/admission/workflows/student-admission.activities.ts',
  'apps/api-gateway/src/institute/certificate/workflows/compliance-export.activities.ts',
  'apps/api-gateway/src/institute/certificate/workflows/tc-issuance.activities.ts',
  'apps/api-gateway/src/institute/setup/institute-setup.activities.ts',
  'apps/api-gateway/src/institute/student/workflows/bulk-student-import.activities.ts',
  // Audit emitter — different contract from EventBusService:
  //   1. Uses `firstValueFrom(client.emit(...))` to await JetStream ack so
  //      audit events cannot be silently lost (audit must be durable; the
  //      fire-and-forget semantics of EventBusService are inappropriate).
  //   2. No GraphQL pubsub fanout — audit consumers are NATS-only by design.
  // Follow-up: type the `'AUDIT.log'` subject via `EVENT_PATTERNS.AUDIT.log`
  // (currently passed as a string literal, bypassing the typed registry).
  'libs/backend/audit/src/audit-emitter.ts',
]);

// Match `this.<name>.emit(` for any of the recognized injected client property
// names — `natsClient`, `jetStreamClient`, or `client`. Allows arbitrary
// whitespace / line breaks between `this.<name>` and `.emit(` to catch the
// split-line form `this.natsClient\n  .emit(...)` that a per-line regex misses.
// The leading `(?:^|[^\w$.])` prevents matches on identifiers ending with one
// of these names (e.g. `foo.notTheClient.emit`).
const NATS_EMIT_RE = /(?:^|[^\w$.])this\.(?:natsClient|jetStreamClient|client)\s*\.\s*emit\s*\(/s;

// "direct nats emit ok" override on either the same line or the previous line
// suppresses a hit (mirrors the prior single-line override behaviour).
const OVERRIDE = 'direct nats emit ok';

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

// Skips a `//` line comment starting at `start`. Returns the index past it and
// the replacement string (spaces, preserving offsets).
function skipLineComment(text: string, start: number): { next: number; out: string } {
  let i = start;
  let out = '';
  while (i < text.length && text[i] !== '\n') {
    out += ' ';
    i++;
  }
  return { next: i, out };
}

function skipBlockComment(text: string, start: number): { next: number; out: string } {
  let i = start + 2;
  let out = '  ';
  while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
    out += text[i] === '\n' ? '\n' : ' ';
    i++;
  }
  if (i < text.length) {
    out += '  ';
    i += 2;
  }
  return { next: i, out };
}

function readStringLiteral(
  text: string,
  start: number,
  quote: string,
): { next: number; out: string } {
  let i = start + 1;
  let out = quote;
  while (i < text.length && text[i] !== quote) {
    if (text[i] === '\\' && i + 1 < text.length) {
      out += text[i] + (text[i + 1] ?? '');
      i += 2;
      continue;
    }
    out += text[i];
    i++;
  }
  if (i < text.length) {
    out += text[i];
    i++;
  }
  return { next: i, out };
}

// Strip line + block comments so a `// this.natsClient.emit(...)` example in a
// docstring doesn't false-positive. Replaces comment characters with spaces so
// line/column offsets are preserved.
function stripComments(text: string): string {
  let out = '';
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const r = skipLineComment(text, i);
      out += r.out;
      i = r.next;
      continue;
    }
    if (ch === '/' && next === '*') {
      const r = skipBlockComment(text, i);
      out += r.out;
      i = r.next;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const r = readStringLiteral(text, i, ch);
      out += r.out;
      i = r.next;
      continue;
    }
    out += ch ?? '';
    i++;
  }
  return out;
}

// Returns true if any line at-or-immediately-before the regex match index
// carries the OVERRIDE marker, which counts as an opt-in suppression.
function hasOverride(originalText: string, matchIndex: number): boolean {
  const before = originalText.slice(0, matchIndex);
  const lines = before.split('\n');
  const currentLine = lines[lines.length - 1] ?? '';
  const previousLine = lines[lines.length - 2] ?? '';
  return currentLine.includes(OVERRIDE) || previousLine.includes(OVERRIDE);
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
    const stripped = stripComments(text);
    const globalRe = new RegExp(NATS_EMIT_RE.source, 'gs');
    let offending = false;
    for (let m = globalRe.exec(stripped); m !== null; m = globalRe.exec(stripped)) {
      if (!hasOverride(text, m.index)) {
        offending = true;
        break;
      }
    }
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
    "\nDirect natsClient.emit / jetStreamClient.emit / client.emit bypasses EventBusService.emit's typed EventPattern boundary.\n" +
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
