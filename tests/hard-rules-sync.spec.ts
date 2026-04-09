import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const RULES_PATH = path.join(ROOT, 'CLAUDE.md');
const REF_PATH = path.join(ROOT, 'docs/references/hard-rules-reference.md');

const INLINE_TAG_RE = /\[([A-Z]{5})\]/g;
const HEADING_TAG_RE = /^###\s+\[([A-Z]{5})\]/gm;

function extractAllTags(content: string): string[] {
  return [...content.matchAll(INLINE_TAG_RE)].map((m) => m[1]);
}

function extractHeadingTags(content: string): string[] {
  return [...content.matchAll(HEADING_TAG_RE)].map((m) => m[1]);
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)].sort();
}

const rulesContent = readFileSync(RULES_PATH, 'utf-8');
const refContent = readFileSync(REF_PATH, 'utf-8');

// Only extract tags from the Hard Rules section of CLAUDE.md
const hardRulesSection = rulesContent.match(/## Hard Rules[\s\S]*?(?=\n## )/)?.[0] ?? '';
const rulesTags = uniqueTags(extractAllTags(hardRulesSection));
const refTags = uniqueTags(extractHeadingTags(refContent));

describe('hard-rules CLAUDE.md ↔ reference sync', () => {
  it('Hard Rules section exists in CLAUDE.md', () => {
    expect(hardRulesSection.length).toBeGreaterThan(0);
  });

  it('both files have the same number of tags', () => {
    expect(rulesTags.length).toBe(refTags.length);
  });

  it('every tag in CLAUDE.md exists in reference', () => {
    const missing = rulesTags.filter((t) => !refTags.includes(t));
    expect(missing, `tags in CLAUDE.md but not in reference: ${missing.join(', ')}`).toEqual([]);
  });

  it('every tag in reference exists in CLAUDE.md', () => {
    const missing = refTags.filter((t) => !rulesTags.includes(t));
    expect(missing, `tags in reference but not in CLAUDE.md: ${missing.join(', ')}`).toEqual([]);
  });

  it('no duplicate tags in CLAUDE.md Hard Rules section', () => {
    const all = extractAllTags(hardRulesSection);
    const dupes = all.filter((t: string, i: number) => all.indexOf(t) !== i);
    expect(dupes, `duplicate tags in CLAUDE.md: ${dupes.join(', ')}`).toEqual([]);
  });

  it('no duplicate heading tags in reference file', () => {
    const all = extractHeadingTags(refContent);
    const dupes = all.filter((t: string, i: number) => all.indexOf(t) !== i);
    expect(dupes, `duplicate heading tags in reference: ${dupes.join(', ')}`).toEqual([]);
  });
});

describe('sed lookup pattern', () => {
  it('every tag section in reference ends with a --- delimiter', () => {
    const missing: string[] = [];

    for (const tag of refTags) {
      const pattern = new RegExp(`\\[${tag}\\][\\s\\S]*?\\n---`);
      if (!pattern.test(refContent)) {
        missing.push(tag);
      }
    }

    expect(missing, `tags missing --- delimiter: ${missing.join(', ')}`).toEqual([]);
  });

  it('extracts non-empty content for every tag', () => {
    const failures: string[] = [];

    for (const tag of refTags) {
      const pattern = new RegExp(`\\[${tag}\\][\\s\\S]*?\\n---`);
      const match = refContent.match(pattern);
      if (!match || match[0].trim().length === 0) {
        failures.push(tag);
      }
    }

    expect(failures, `sed pattern returned empty for: ${failures.join(', ')}`).toEqual([]);
  });

  it('extracted content starts with the tag heading', () => {
    for (const tag of refTags) {
      const pattern = new RegExp(`(\\[${tag}\\][\\s\\S]*?)\\n---`);
      const match = refContent.match(pattern);
      expect(match, `no match for [${tag}]`).not.toBeNull();
      expect(match?.[1]).toContain(`[${tag}]`);
    }
  });
});
