import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractTableNames,
  findGaps,
  isSoftDeletable,
  loadLiveViewExports,
} from '../check-live-views-coverage';

describe('isSoftDeletable', () => {
  it('returns true for tenantColumns spread', () => {
    expect(isSoftDeletable('export const t = pgTable("t", { ...tenantColumns });')).toBe(true);
  });

  it('returns true for entityColumns spread', () => {
    expect(isSoftDeletable('export const t = pgTable("t", { ...entityColumns });')).toBe(true);
  });

  it('returns true for explicit deletedAt column', () => {
    expect(isSoftDeletable('deletedAt: timestamp("deleted_at"),')).toBe(true);
  });

  it('returns false for plain timestamps-only table', () => {
    expect(isSoftDeletable('export const t = pgTable("t", { ...timestamps });')).toBe(false);
  });

  it('does not match deletedAtSomethingElse identifier', () => {
    expect(isSoftDeletable('const deletedAtFlag = true;')).toBe(false);
  });
});

describe('extractTableNames', () => {
  it('returns a single table name', () => {
    expect(extractTableNames('export const subjects = pgTable("subjects", {})')).toEqual([
      'subjects',
    ]);
  });

  it('returns multiple table names', () => {
    const text = `
      export const a = pgTable('a', {});
      export const b = pgTable('b', {});
    `;
    expect(extractTableNames(text)).toEqual(['a', 'b']);
  });

  it('returns empty array when nothing matches', () => {
    expect(extractTableNames('export const x = 1;')).toEqual([]);
  });
});

describe('loadLiveViewExports', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lvcov-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty set when file is missing', () => {
    expect(loadLiveViewExports(join(dir, 'nope.ts')).size).toBe(0);
  });

  it('loads *Live exports', () => {
    const file = join(dir, 'live-views.ts');
    writeFileSync(
      file,
      `
      export const subjectsLive = pgView('subjects_live').as(qb => qb);
      export const sectionsLive = pgView('sections_live').as(qb => qb);
      export const helper = 1;
      `,
    );
    const out = loadLiveViewExports(file);
    expect(out.has('subjectsLive')).toBe(true);
    expect(out.has('sectionsLive')).toBe(true);
    expect(out.has('helper')).toBe(false);
  });
});

describe('findGaps', () => {
  let dir: string;
  let liveViewsFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lvcov-'));
    liveViewsFile = join(dir, 'live-views.ts');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns no gaps when every soft-deletable table has a *Live view', () => {
    writeFileSync(
      join(dir, 'subjects.ts'),
      `export const subjects = pgTable('subjects', { ...tenantColumns });`,
    );
    writeFileSync(liveViewsFile, `export const subjectsLive = pgView('subjects_live').as(q=>q);`);
    expect(findGaps(dir, liveViewsFile)).toEqual([]);
  });

  it('flags a soft-deletable table missing its *Live view', () => {
    writeFileSync(
      join(dir, 'subjects.ts'),
      `export const subjects = pgTable('subjects', { ...tenantColumns });`,
    );
    writeFileSync(liveViewsFile, '');
    const gaps = findGaps(dir, liveViewsFile);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].tableName).toBe('subjects');
    expect(gaps[0].expectedExport).toBe('subjectsLive');
  });

  it('ignores non-soft-deletable tables', () => {
    writeFileSync(
      join(dir, 'sequences.ts'),
      `export const sequences = pgTable('sequences', { ...timestamps });`,
    );
    writeFileSync(liveViewsFile, '');
    expect(findGaps(dir, liveViewsFile)).toEqual([]);
  });

  it('skips files in the SKIP_BASENAMES list', () => {
    writeFileSync(
      join(dir, 'index.ts'),
      `export const ghost = pgTable('ghost', { ...entityColumns });`,
    );
    writeFileSync(liveViewsFile, '');
    expect(findGaps(dir, liveViewsFile)).toEqual([]);
  });

  it('walks nested subdirectories', () => {
    const sub = join(dir, 'tenant');
    mkdirSync(sub);
    writeFileSync(
      join(sub, 'roles.ts'),
      `export const roles = pgTable('roles', { ...tenantColumns });`,
    );
    writeFileSync(liveViewsFile, '');
    const gaps = findGaps(dir, liveViewsFile);
    expect(gaps.map((g) => g.tableName)).toEqual(['roles']);
  });
});
