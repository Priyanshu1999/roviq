// Static-source coverage check: every `@Resolver` class in api-gateway is
// registered as a provider in some `*.module.ts`.
//
// Forgetting to wire a new resolver into a module is a silent runtime
// bug — the GraphQL schema simply omits the type/operations and the
// frontend gets `null` or "field not found" against an endpoint that
// looks like it should exist. NestJS does not surface this at boot.
//
// We do this with regex over source rather than booting AppModule because
// the goal is to catch the omission at the same review hop where the
// resolver was added; booting the full app has 10× the runtime cost and
// requires a working DB/NATS stack.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_GATEWAY_SRC = join(__dirname, '..');
const EE_API_GATEWAY_SRC = join(__dirname, '../../../../ee/apps/api-gateway/src');

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

interface ResolverDecl {
  className: string;
  file: string;
}

// Matches `@Resolver(...)\n... class Foo` and `export class Foo`.
const RESOLVER_RE =
  /@Resolver\s*\([^)]*\)[\s\S]{0,400}?(?:export\s+)?class\s+([A-Z][A-Za-z0-9_]*)/g;

function collectResolvers(): ResolverDecl[] {
  const out: ResolverDecl[] = [];
  for (const file of [...safeWalk(API_GATEWAY_SRC), ...safeWalk(EE_API_GATEWAY_SRC)]) {
    const content = readFileSync(file, 'utf8');
    RESOLVER_RE.lastIndex = 0;
    for (const match of content.matchAll(RESOLVER_RE)) {
      const className = match[1];
      if (className) out.push({ className, file });
    }
  }
  return out;
}

// Extract the `{ … }` body of every `@Module(...)` decorator using a
// brace counter — a regex with `[\s\S]*?` truncates at the first nested
// `})` (e.g. `JwtModule.register({})`) and misses half the providers.
function extractModuleBodies(content: string): string[] {
  const bodies: string[] = [];
  const decoratorRe = /@Module\s*\(\s*\{/g;
  for (const match of content.matchAll(decoratorRe)) {
    if (match.index === undefined) continue;
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth === 0) bodies.push(content.slice(start, i - 1));
  }
  return bodies;
}

function collectModuleProviders(): Set<string> {
  // Captures every identifier that appears inside the `@Module(...)`
  // decorator body. We scan the literal text — the goal is to confirm
  // the class name is *referenced*, not to parse NestJS metadata.
  const referenced = new Set<string>();
  const moduleFiles = [...safeWalk(API_GATEWAY_SRC), ...safeWalk(EE_API_GATEWAY_SRC)].filter((f) =>
    f.endsWith('.module.ts'),
  );
  for (const file of moduleFiles) {
    const content = readFileSync(file, 'utf8');
    for (const body of extractModuleBodies(content)) {
      for (const idMatch of body.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
        const name = idMatch[1];
        if (name) referenced.add(name);
      }
    }
  }
  return referenced;
}

describe('module registration coverage', () => {
  it('every @Resolver class is referenced in some @Module()', () => {
    const resolvers = collectResolvers();
    expect(resolvers.length).toBeGreaterThan(20); // sanity: we should see ~50

    const referenced = collectModuleProviders();

    const orphans = resolvers.filter((r) => !referenced.has(r.className));
    const formatted = orphans.map(
      (o) => `${o.className}  (${o.file.split('/').slice(-3).join('/')})`,
    );
    expect(orphans, `unwired @Resolver classes:\n  ${formatted.join('\n  ')}`).toEqual([]);
  });
});
