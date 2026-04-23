/**
 * Scope-guard meta-test — structural invariant.
 *
 * Walks the filesystem (no Nest boot) and asserts every resolver file under
 * each scope directory has the correct scope guard applied. This catches the
 * "new resolver shipped without a guard" regression at build time instead of
 * waiting for a forgotten cross-scope rejection test.
 *
 * Lives under `__tests__/*.integration.spec.ts` because it is a structural
 * invariant that belongs alongside the other integration tests that verify
 * scope guards at runtime.
 */

import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

interface Case {
  readonly name: string;
  readonly dir: string;
  readonly required: RegExp;
}

const CASES: readonly Case[] = [
  {
    name: 'admin resolvers have PlatformScopeGuard or @PlatformScope()',
    dir: 'apps/api-gateway/src/admin',
    required: /@PlatformScope\(\)|PlatformScopeGuard/,
  },
  {
    name: 'reseller resolvers have ResellerScopeGuard or @ResellerScope()',
    dir: 'apps/api-gateway/src/reseller',
    required: /@ResellerScope\(\)|ResellerScopeGuard/,
  },
  {
    name: 'institute resolvers have InstituteScopeGuard or @InstituteScope()',
    dir: 'apps/api-gateway/src/institute',
    required: /@InstituteScope\(\)|InstituteScopeGuard/,
  },
  {
    name: 'ee billing institute resolvers have InstituteScopeGuard or @InstituteScope()',
    dir: 'ee/apps/api-gateway/src/billing/institute',
    required: /@InstituteScope\(\)|InstituteScopeGuard/,
  },
  {
    name: 'ee billing reseller resolvers have ResellerScopeGuard or @ResellerScope()',
    dir: 'ee/apps/api-gateway/src/billing/reseller',
    required: /@ResellerScope\(\)|ResellerScopeGuard/,
  },
];

async function walkResolvers(absDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.resolver.ts')) {
        out.push(full);
      }
    }
  }
  await walk(absDir);
  return out;
}

/**
 * A @Resolver class is "root-exposing" — and therefore requires its own scope
 * guard — when it declares any of `@Query`, `@Mutation`, or `@Subscription`.
 *
 * Classes that only declare `@ResolveField` are field resolvers on an
 * ObjectType: they are invoked lazily from within a parent query whose scope
 * guard has already fired. Requiring them to also carry a scope guard would
 * force a single-scope binding and prevent `@ResolveField` from serving
 * admin, reseller, and institute queries that all return the same GraphQL
 * type — so field-only resolvers are intentionally exempt from this test.
 */
function declaresRootOperations(content: string): boolean {
  return /@(Query|Mutation|Subscription)\s*\(/.test(content);
}

describe('Scope guard meta-test — every resolver has correct guard', () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const absDir = join(REPO_ROOT, testCase.dir);
      const files = await walkResolvers(absDir);
      expect(files.length, `no resolver files found under ${testCase.dir}`).toBeGreaterThan(0);

      const missing: string[] = [];
      for (const file of files) {
        const content = await readFile(file, 'utf8');
        // Only inspect files that actually define a @Resolver class — some
        // *.resolver.ts files might be interfaces, types, or helper modules.
        if (!/@Resolver\s*\(/.test(content)) continue;
        // Field-only resolver classes inherit auth from the parent query.
        if (!declaresRootOperations(content)) continue;
        if (!testCase.required.test(content)) {
          missing.push(file.replace(`${REPO_ROOT}/`, ''));
        }
      }

      expect(missing, `resolvers missing required scope guard: ${missing.join(', ')}`).toEqual([]);
    });
  }
});
