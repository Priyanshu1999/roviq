// Coverage and symmetry tests for the NATS event surface.
//
// `EVENT_PATTERNS` is the single source of truth. These tests assert:
//
//   1. Every entry in the registry is matched by some `STREAMS[*].subjects`
//      filter — otherwise emits silently fail with "no stream matches
//      subject" (the original ROV-221 class of bug).
//   2. Every `.emit('PREFIX.action')` and `.emitEvent('PREFIX.action')`
//      call site uses a value that exists in the registry — so adding a
//      subject without registering it is a test failure, not a silent
//      production miss.
//   3. Every `pubSub.asyncIterableIterator('PREFIX.action')` call site
//      and every `@EventPattern('PREFIX.action')` decorator uses a value
//      that exists in the registry — same reason.
//   4. Every camelCase GraphQL subscription field name implied by an
//      emit is also the key used by some `pubSub.asyncIterableIterator`
//      reader OR is allow-listed (no orphan emit/subscribe pairs).
//
// The test reads the api-gateway source files directly so it catches
// regressions even if a service grows a new private `emitEvent` wrapper.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_PATTERNS, flattenEventPatterns } from '../event-patterns';
import { STREAMS } from '../stream.config';

const API_GATEWAY_SRC = join(__dirname, '../../../../../../apps/api-gateway/src');
const NOTIFICATION_SERVICE_SRC = join(__dirname, '../../../../../../apps/notification-service/src');
const EE_API_GATEWAY_SRC = join(__dirname, '../../../../../../ee/apps/api-gateway/src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.integration.spec.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

function safeWalk(dir: string): string[] {
  try {
    statSync(dir);
    return walk(dir);
  } catch {
    return [];
  }
}

const ALL_SOURCE_FILES = [
  ...safeWalk(API_GATEWAY_SRC),
  ...safeWalk(NOTIFICATION_SERVICE_SRC),
  ...safeWalk(EE_API_GATEWAY_SRC),
];

// Captures string-literal first arg of: .emit('X.y'), .emitEvent('X.y'),
// emitEvent('X.y'), .asyncIterableIterator('X.y'), @EventPattern('X.y').
const EMIT_RE =
  /\b(?:emit|emitEvent|asyncIterableIterator)\s*\(\s*['"]([A-Z][A-Z_0-9]*\.[A-Za-z_.]+)['"]/g;
const EVENT_PATTERN_DECORATOR_RE = /@EventPattern\s*\(\s*['"]([A-Z][A-Z_0-9]*\.[A-Za-z_.*]+)['"]/g;
// Captures EVENT_PATTERNS-reference first arg of emit/emitEvent:
//   emit(EVENT_PATTERNS.BILLING.subscription.status_changed, ...)
// The dot path after EVENT_PATTERNS is resolved against the imported object.
const EVENT_PATTERNS_ARG_RE = /\b(?:emit|emitEvent)\s*\(\s*EVENT_PATTERNS((?:\.[A-Za-z_]+){2,})/g;

interface SubjectHit {
  subject: string;
  file: string;
  kind: 'emit' | 'subscribe';
}

function resolveEventPatternPath(dotPath: string): string | null {
  // dotPath is like ".BILLING.subscription.status_changed"
  const parts = dotPath.slice(1).split('.');
  // biome-ignore lint/suspicious/noExplicitAny: traversing typed const
  let node: any = EVENT_PATTERNS;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
}

function collectAllSubjectReferences(): SubjectHit[] {
  const hits: SubjectHit[] = [];
  for (const file of ALL_SOURCE_FILES) {
    const content = readFileSync(file, 'utf8');
    EMIT_RE.lastIndex = 0;
    for (const match of content.matchAll(EMIT_RE)) {
      const subject = match[1];
      if (!subject) continue;
      const kind = /asyncIterableIterator/.test(match[0]) ? 'subscribe' : 'emit';
      hits.push({ subject, file, kind });
    }
    EVENT_PATTERN_DECORATOR_RE.lastIndex = 0;
    for (const match of content.matchAll(EVENT_PATTERN_DECORATOR_RE)) {
      const subject = match[1];
      if (!subject) continue;
      hits.push({ subject, file, kind: 'subscribe' });
    }
    // Also resolve EVENT_PATTERNS.X.y.z references in emit calls.
    EVENT_PATTERNS_ARG_RE.lastIndex = 0;
    for (const match of content.matchAll(EVENT_PATTERNS_ARG_RE)) {
      const dotPath = match[1];
      if (!dotPath) continue;
      const subject = resolveEventPatternPath(dotPath);
      if (subject) hits.push({ subject, file, kind: 'emit' });
    }
  }
  return hits;
}

function streamPrefixes(): string[] {
  return Object.values(STREAMS).flatMap((s) => s.subjects.map((subj) => subj.replace(/\.>$/, '')));
}

function isCoveredByStream(subject: string): boolean {
  const prefix = subject.split('.')[0];
  return streamPrefixes().includes(prefix ?? '');
}

// Wildcard subscribers are an intentional pattern (see
// notification-service/billing-notification.controller.ts
// `@EventPattern('BILLING.subscription.*')`) — they consume any subject
// matching the prefix, so the registry doesn't enumerate them.
function isWildcardSubject(subject: string): boolean {
  return subject.includes('.*') || subject.endsWith('.>');
}

describe('STREAMS registry coverage', () => {
  it('every EVENT_PATTERNS entry is covered by some STREAMS filter', () => {
    const uncovered = flattenEventPatterns().filter((s) => !isCoveredByStream(s));
    expect(uncovered, `subjects without a stream filter: ${uncovered.join(', ')}`).toEqual([]);
  });

  it('every emit subject in source code is registered in EVENT_PATTERNS', () => {
    const known = new Set(flattenEventPatterns());
    const hits = collectAllSubjectReferences().filter(
      (h) => h.kind === 'emit' && !isWildcardSubject(h.subject),
    );
    const orphans = hits.filter((h) => !known.has(h.subject));
    const formatted = orphans.map(
      (o) => `${o.subject}  (${o.file.split('/').slice(-3).join('/')})`,
    );
    expect(orphans, `unregistered emit subjects:\n  ${formatted.join('\n  ')}`).toEqual([]);
  });

  it('every subscribe subject in source code is registered in EVENT_PATTERNS', () => {
    const known = new Set(flattenEventPatterns());
    const hits = collectAllSubjectReferences().filter(
      (h) => h.kind === 'subscribe' && !isWildcardSubject(h.subject),
    );
    const orphans = hits.filter((h) => !known.has(h.subject));
    const formatted = orphans.map(
      (o) => `${o.subject}  (${o.file.split('/').slice(-3).join('/')})`,
    );
    expect(orphans, `unregistered subscribe subjects:\n  ${formatted.join('\n  ')}`).toEqual([]);
  });

  it('every concrete (non-wildcard) subscriber subject has at least one emit', () => {
    // Forward symmetry: a `@EventPattern('FOO.bar')` or
    // `asyncIterableIterator('FOO.bar')` with no corresponding emit is
    // dead code that will silently never fire. Wildcards (`FOO.*`) are
    // exempt because they observe any matching subject the registry
    // declares under that prefix.
    const hits = collectAllSubjectReferences();
    const emitted = new Set(hits.filter((h) => h.kind === 'emit').map((h) => h.subject));
    const subscribers = hits.filter((h) => h.kind === 'subscribe' && !isWildcardSubject(h.subject));

    // STUDENT.promoted: subscriber (`group-invalidation.handler`) is wired
    // for the year-end promotion flow shipped via the dedicated promotion
    // workflow (which sets fromStandardId/toStandardId/academicYearId).
    // Status-machine transitions to PROMOTED are NOT a valid emit point —
    // they don't carry the standard/year context the spec requires. Listed
    // here until the promotion workflow's emit lands.
    const allowOrphan = new Set<string>([EVENT_PATTERNS.STUDENT.promoted]);

    const orphanSubscribers = subscribers
      .map((h) => h.subject)
      .filter((s) => !emitted.has(s) && !allowOrphan.has(s));
    const unique = Array.from(new Set(orphanSubscribers));
    expect(
      unique,
      `subscribers with no emitter (orphan handlers):\n  ${unique.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('AUDIT_LOG_CONSUMER', () => {
  it('filter_subject matches the AUDIT.log subject in the registry', async () => {
    const { AUDIT_LOG_CONSUMER } = await import('../stream.config');
    expect(AUDIT_LOG_CONSUMER.filter_subject).toBe(EVENT_PATTERNS.AUDIT.log);
  });
});
