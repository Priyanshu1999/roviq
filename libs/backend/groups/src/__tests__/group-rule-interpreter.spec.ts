/**
 * Unit tests for groupRuleToSql — the @ucast/sql interpreter wrapper (ROV-163).
 *
 * Tests that rules produce parameterized SQL with correct table-qualified column names.
 */
import { describe, expect, it } from 'vitest';
import { groupRuleToSql } from '../group-rule-interpreter';

describe('groupRuleToSql', () => {
  it('simple equality → parameterized SQL with table-qualified column', () => {
    const result = groupRuleToSql({ '==': [{ var: 'gender' }, 'female'] });
    expect(result).toBeDefined();
    expect(result?.sqlString).toContain('"user_profiles"."gender"');
    expect(result?.params).toContain('female');
  });

  it('complex 5-dimension AND rule → all columns correctly mapped', () => {
    const result = groupRuleToSql({
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { in: [{ var: 'social_category' }, ['sc', 'st']] },
        { '==': [{ var: 'standard_id' }, 'uuid-10'] },
        { '==': [{ var: 'stream' }, 'science_pcm'] },
        { '==': [{ var: 'academic_status' }, 'enrolled'] },
      ],
    });
    expect(result).toBeDefined();
    // All 5 columns should appear in the SQL
    expect(result?.sqlString).toContain('"user_profiles"."gender"');
    expect(result?.sqlString).toContain('"student_profiles"."social_category"');
    expect(result?.sqlString).toContain('"student_academics"."standard_id"');
    expect(result?.sqlString).toContain('"student_profiles"."stream"');
    expect(result?.sqlString).toContain('"student_profiles"."academic_status"');
    // Params should contain all values
    expect(result?.params).toContain('female');
    expect(result?.params).toContain('uuid-10');
    expect(result?.params).toContain('science_pcm');
    expect(result?.params).toContain('enrolled');
  });

  it('empty rule → undefined', () => {
    expect(groupRuleToSql({})).toBeUndefined();
  });

  it('null rule → undefined', () => {
    expect(groupRuleToSql(null as never)).toBeUndefined();
  });

  it('in operator → correct SQL with array params', () => {
    const result = groupRuleToSql({ in: [{ var: 'social_category' }, ['sc', 'st', 'obc']] });
    expect(result).toBeDefined();
    expect(result?.sqlString).toContain('"student_profiles"."social_category"');
    // Should contain IN clause params
    expect(result?.params).toContain('sc');
    expect(result?.params).toContain('st');
    expect(result?.params).toContain('obc');
  });

  it('NOT operator → SQL contains NOT', () => {
    const result = groupRuleToSql({ '!': [{ '==': [{ var: 'is_bpl' }, true] }] });
    expect(result).toBeDefined();
    expect(result?.sqlString.toUpperCase()).toContain('NOT');
  });

  it('section dimension maps to student_academics table', () => {
    const result = groupRuleToSql({ '==': [{ var: 'section_id' }, 'some-uuid'] });
    expect(result?.sqlString).toContain('"student_academics"."section_id"');
  });

  it('shift dimension maps to sections table', () => {
    const result = groupRuleToSql({ '==': [{ var: 'shift' }, 'morning'] });
    expect(result?.sqlString).toContain('"sections"."shift"');
  });

  it('medium dimension maps to sections.medium_of_instruction', () => {
    const result = groupRuleToSql({ '==': [{ var: 'medium' }, 'hindi'] });
    expect(result?.sqlString).toContain('"sections"."medium_of_instruction"');
  });

  // ── null handling ─────────────────────────────────────────
  // Parser maps == null → @ucast/sql 'exists' operator → "IS NULL"
  // Parser maps != null → @ucast/sql 'exists' operator → "IS NOT NULL"

  it('== null → SQL contains IS NULL', () => {
    const result = groupRuleToSql({ '==': [{ var: 'stream' }, null] });
    expect(result).toBeDefined();
    expect(result?.sqlString.toLowerCase()).toContain('is null');
    expect(result?.sqlString.toLowerCase()).not.toContain('is not null');
  });

  it('!= null → SQL contains IS NOT NULL', () => {
    const result = groupRuleToSql({ '!=': [{ var: 'stream' }, null] });
    expect(result).toBeDefined();
    expect(result?.sqlString.toLowerCase()).toContain('is not null');
  });

  // ── Issue self-verification: empty in array → no crash ───

  it('empty in array → does not produce SQL syntax error', () => {
    // @ucast/sql should handle this gracefully
    expect(() => groupRuleToSql({ in: [{ var: 'social_category' }, []] })).not.toThrow();
  });

  // ── Truthy !! → correct SQL ──────────────────────────────

  it('!! truthy operator → SQL with = true', () => {
    const result = groupRuleToSql({ '!!': [{ var: 'is_cwsn' }] });
    expect(result).toBeDefined();
    expect(result?.sqlString).toContain('"student_profiles"."is_cwsn"');
    expect(result?.params).toContain(true);
  });
});
