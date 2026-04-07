import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STREAMS } from '../stream.config';

/**
 * Regression for ROV-221: every subject prefix emitted from api-gateway services
 * must have a matching stream registered in STREAMS. Without this, the publish
 * silently errors with "no stream matches subject" and downstream consumers
 * never attach.
 */
describe('STREAMS registry coverage', () => {
  const apiGatewaySrc = join(__dirname, '../../../../../../apps/api-gateway/src');

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '__tests__') continue;
        out.push(...walk(full));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  function collectPublishedPrefixes(): Map<string, string[]> {
    const prefixToFiles = new Map<string, string[]>();

    for (const file of walk(apiGatewaySrc)) {
      const content = readFileSync(file, 'utf8');
      const matches = content.matchAll(/\.emit\(\s*['"]([A-Z_]+)\.[a-zA-Z_]+['"]/g);
      for (const match of matches) {
        const prefix = match[1];
        if (prefix) {
          const existing = prefixToFiles.get(prefix) ?? [];
          existing.push(file);
          prefixToFiles.set(prefix, existing);
        }
      }
    }

    return prefixToFiles;
  }

  function prefixIsCovered(prefix: string): boolean {
    for (const stream of Object.values(STREAMS)) {
      for (const subject of stream.subjects) {
        // subject format is "PREFIX.>"
        const streamPrefix = subject.replace(/\.>$/, '');
        if (streamPrefix === prefix) return true;
      }
    }
    return false;
  }

  it('every emit subject prefix in api-gateway has a matching stream', () => {
    const prefixes = collectPublishedPrefixes();
    const missing: string[] = [];

    for (const [prefix, files] of prefixes) {
      if (!prefixIsCovered(prefix)) {
        missing.push(
          `${prefix} (published in: ${files.map((f) => f.split('/').slice(-2).join('/')).join(', ')})`,
        );
      }
    }

    expect(missing).toEqual([]);
  });

  it('contains the 6 previously missing streams', () => {
    // ROV-221 regression: these were added to cover silent publish failures
    expect(STREAMS).toHaveProperty('SECTION');
    expect(STREAMS).toHaveProperty('STUDENT');
    expect(STREAMS).toHaveProperty('GROUP');
    expect(STREAMS).toHaveProperty('APPLICATION');
    expect(STREAMS).toHaveProperty('ENQUIRY');
    expect(STREAMS).toHaveProperty('ACADEMIC_YEAR');
  });
});
