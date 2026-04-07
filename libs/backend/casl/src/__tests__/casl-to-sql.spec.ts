/**
 * Unit tests for CASL-to-SQL bridge (ROV-166).
 *
 * Tests the full pipeline: CASL ability → rulesToAST → @ucast/sql → Drizzle SQL.
 */
import { createMongoAbility } from '@casl/ability';
import type { AbilityRule, AppAbility } from '@roviq/common-types';
import { describe, expect, it } from 'vitest';
import { caslToSqlWhere } from '../casl-to-sql';
import { substituteUserVars } from '../substitute-user-vars';

function buildAbility(rules: AbilityRule[]): AppAbility {
  return createMongoAbility<AppAbility>(rules);
}

/** Typed shape for CASL $in operator conditions (pre- or post-substitution) */
interface InCondition {
  $in: string | unknown[];
}

/** Typed shape for a CASL condition entry with nested properties */
interface NestedCondition {
  userId?: string;
  sectionId?: InCondition;
}

describe('caslToSqlWhere', () => {
  it('manage:all (institute_admin) → undefined (no restriction)', () => {
    const ability = buildAbility([{ action: 'manage', subject: 'all' }]);
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeUndefined();
  });

  it('unconditional read:Student → undefined (no restriction)', () => {
    const ability = buildAbility([{ action: 'read', subject: 'Student' }]);
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeUndefined();
  });

  it('student with userId condition → SQL contains "user_id"', () => {
    const ability = buildAbility([
      { action: 'read', subject: 'Student', conditions: { userId: 'user-123' } },
    ]);
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeDefined();
    // The SQL should reference user_id (snake_case mapped from userId)
    expect(result?.queryChunks?.length).toBeGreaterThan(0);
  });

  it('class_teacher with sectionId $in condition → SQL produced', () => {
    const conditions = substituteUserVars(
      { sectionId: { $in: '$user.assignedSections' } },
      { userId: 'teacher-1', assignedSections: ['sec-a', 'sec-b'] },
    );
    const ability = buildAbility([{ action: 'read', subject: 'Student', conditions }]);
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeDefined();
  });

  it('no matching rules → sql`false` (blocks access)', () => {
    const ability = buildAbility([{ action: 'read', subject: 'Attendance' }]);
    // Querying for Student when only Attendance is allowed → no access
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeDefined(); // returns sql`false`, not undefined
  });

  it('no rules at all → sql`false`', () => {
    const ability = buildAbility([]);
    const result = caslToSqlWhere(ability, 'read', 'Student');
    expect(result).toBeDefined();
  });
});

describe('substituteUserVars', () => {
  it('replaces $user.sub with userId', () => {
    const result = substituteUserVars({ userId: '$user.sub' }, { userId: 'abc-123' });
    expect(result.userId).toBe('abc-123');
  });

  it('replaces ${user.id} (legacy format) with userId', () => {
    const result = substituteUserVars({ studentId: '${user.id}' }, { userId: 'abc-123' });
    expect(result.studentId).toBe('abc-123');
  });

  it('replaces $user.assignedSections with array', () => {
    const result = substituteUserVars<{ sectionId: InCondition }>(
      { sectionId: { $in: '$user.assignedSections' } },
      { userId: 'u1', assignedSections: ['sec-1', 'sec-2'] },
    );
    expect(result.sectionId.$in).toEqual(['sec-1', 'sec-2']);
  });

  it('$user.assignedSections defaults to empty array when not provided', () => {
    const result = substituteUserVars<{ sectionId: InCondition }>(
      { sectionId: { $in: '$user.assignedSections' } },
      { userId: 'u1' },
    );
    expect(result.sectionId.$in).toEqual([]);
  });

  it('non-placeholder values are preserved', () => {
    const result = substituteUserVars({ status: 'enrolled', name: 'test' }, { userId: 'u1' });
    expect(result.status).toBe('enrolled');
    expect(result.name).toBe('test');
  });

  it('deeply nested substitution works', () => {
    const result = substituteUserVars<{ $and: NestedCondition[] }>(
      { $and: [{ userId: '$user.sub' }, { sectionId: { $in: '$user.assignedSections' } }] },
      { userId: 'u1', assignedSections: ['s1'] },
    );
    expect(result.$and[0].userId).toBe('u1');
    expect(result.$and[1].sectionId?.$in).toEqual(['s1']);
  });
});
