/**
 * Unit tests for JsonLogic → @ucast/core AST parser (ROV-163).
 *
 * Tests every operator, array unwrapping for !, !! truthy, error cases.
 */
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { describe, expect, it } from 'vitest';
import { jsonLogicToUcast } from '../json-logic-to-ucast';

describe('jsonLogicToUcast', () => {
  // ── Simple equality (==) ───────────────────────────────

  it('== → FieldCondition("eq", field, value)', () => {
    const result = jsonLogicToUcast({ '==': [{ var: 'gender' }, 'female'] });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).operator).toBe('eq');
    expect((result as FieldCondition).field).toBe('gender');
    expect((result as FieldCondition).value).toBe('female');
  });

  it('== with boolean value', () => {
    const result = jsonLogicToUcast({ '==': [{ var: 'is_rte_admitted' }, true] });
    expect((result as FieldCondition).operator).toBe('eq');
    expect((result as FieldCondition).value).toBe(true);
  });

  it('== null → FieldCondition("exists", field, false) for IS NULL', () => {
    const result = jsonLogicToUcast({ '==': [{ var: 'stream' }, null] });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).operator).toBe('exists');
    expect((result as FieldCondition).field).toBe('stream');
    expect((result as FieldCondition).value).toBe(false);
  });

  it('!= null → FieldCondition("exists", field, true) for IS NOT NULL', () => {
    const result = jsonLogicToUcast({ '!=': [{ var: 'stream' }, null] });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).operator).toBe('exists');
    expect((result as FieldCondition).value).toBe(true);
  });

  // ── Inequality (!=) ────────────────────────────────────

  it('!= → FieldCondition("ne")', () => {
    const result = jsonLogicToUcast({ '!=': [{ var: 'academic_status' }, 'expelled'] });
    expect((result as FieldCondition).operator).toBe('ne');
    expect((result as FieldCondition).field).toBe('academic_status');
  });

  // ── Comparison (>, >=, <, <=) ──────────────────────────

  it('> → FieldCondition("gt")', () => {
    const result = jsonLogicToUcast({ '>': [{ var: 'age' }, 14] });
    expect((result as FieldCondition).operator).toBe('gt');
    expect((result as FieldCondition).value).toBe(14);
  });

  it('>= → FieldCondition("gte")', () => {
    const result = jsonLogicToUcast({ '>=': [{ var: 'age' }, 6] });
    expect((result as FieldCondition).operator).toBe('gte');
  });

  it('< → FieldCondition("lt")', () => {
    const result = jsonLogicToUcast({ '<': [{ var: 'age' }, 18] });
    expect((result as FieldCondition).operator).toBe('lt');
  });

  it('<= → FieldCondition("lte")', () => {
    const result = jsonLogicToUcast({ '<=': [{ var: 'age' }, 12] });
    expect((result as FieldCondition).operator).toBe('lte');
  });

  // ── In operator ────────────────────────────────────────

  it('in → FieldCondition("in", field, array)', () => {
    const result = jsonLogicToUcast({ in: [{ var: 'social_category' }, ['sc', 'st']] });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).operator).toBe('in');
    expect((result as FieldCondition).field).toBe('social_category');
    expect((result as FieldCondition).value).toEqual(['sc', 'st']);
  });

  it('in with empty array', () => {
    const result = jsonLogicToUcast({ in: [{ var: 'social_category' }, []] });
    expect((result as FieldCondition).value).toEqual([]);
  });

  // ── AND operator ───────────────────────────────────────

  it('and → CompoundCondition("and", children)', () => {
    const result = jsonLogicToUcast({
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { in: [{ var: 'social_category' }, ['sc', 'st']] },
      ],
    });
    expect(result).toBeInstanceOf(CompoundCondition);
    expect((result as CompoundCondition).operator).toBe('and');
    expect((result as CompoundCondition).value).toHaveLength(2);
  });

  // ── OR operator ────────────────────────────────────────

  it('or → CompoundCondition("or", children)', () => {
    const result = jsonLogicToUcast({
      or: [{ '==': [{ var: 'is_bpl' }, true] }, { '==': [{ var: 'is_cwsn' }, true] }],
    });
    expect(result).toBeInstanceOf(CompoundCondition);
    expect((result as CompoundCondition).operator).toBe('or');
    expect((result as CompoundCondition).value).toHaveLength(2);
  });

  // ── NOT operator (! with array unwrapping) ─────────────

  it('! with array wrapping → CompoundCondition("not") — the bug the custom impl had', () => {
    // {"!": [{"==": [{"var": "is_bpl"}, true]}]} — operand is an ARRAY with one element
    const result = jsonLogicToUcast({ '!': [{ '==': [{ var: 'is_bpl' }, true] }] });
    expect(result).toBeInstanceOf(CompoundCondition);
    expect((result as CompoundCondition).operator).toBe('not');
    expect((result as CompoundCondition).value).toHaveLength(1);
    expect((result as CompoundCondition).value[0]).toBeInstanceOf(FieldCondition);
  });

  it('! without array wrapping → CompoundCondition("not")', () => {
    const result = jsonLogicToUcast({ '!': { '==': [{ var: 'is_bpl' }, true] } });
    expect(result).toBeInstanceOf(CompoundCondition);
    expect((result as CompoundCondition).operator).toBe('not');
  });

  // ── Truthy: !! (double-not) ────────────────────────────

  it('!! with array → FieldCondition("eq", field, true)', () => {
    const result = jsonLogicToUcast({ '!!': [{ var: 'is_cwsn' }] });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).operator).toBe('eq');
    expect((result as FieldCondition).field).toBe('is_cwsn');
    expect((result as FieldCondition).value).toBe(true);
  });

  it('!! without array → FieldCondition("eq", field, true)', () => {
    const result = jsonLogicToUcast({ '!!': { var: 'is_minority' } });
    expect(result).toBeInstanceOf(FieldCondition);
    expect((result as FieldCondition).field).toBe('is_minority');
    expect((result as FieldCondition).value).toBe(true);
  });

  // ── Nested combinations ────────────────────────────────

  it('nested: and [ ==, or [ ==, == ] ]', () => {
    const result = jsonLogicToUcast({
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        {
          or: [
            { '==': [{ var: 'social_category' }, 'sc'] },
            { '==': [{ var: 'social_category' }, 'st'] },
          ],
        },
      ],
    });
    expect(result).toBeInstanceOf(CompoundCondition);
    const compound = result as CompoundCondition;
    expect(compound.operator).toBe('and');
    expect(compound.value).toHaveLength(2);
    expect(compound.value[0]).toBeInstanceOf(FieldCondition);
    expect(compound.value[1]).toBeInstanceOf(CompoundCondition);
    expect((compound.value[1] as CompoundCondition).operator).toBe('or');
  });

  it('complex 5-dimension rule from PRD example', () => {
    const result = jsonLogicToUcast({
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { in: [{ var: 'social_category' }, ['sc', 'st']] },
        { '==': [{ var: 'standard_id' }, 'uuid-of-class-10'] },
        { '==': [{ var: 'stream' }, 'science_pcm'] },
        { '==': [{ var: 'academic_status' }, 'enrolled'] },
      ],
    });
    const compound = result as CompoundCondition;
    expect(compound.operator).toBe('and');
    expect(compound.value).toHaveLength(5);
  });

  // ── Error cases ────────────────────────────────────────

  it('unsupported operator → throws', () => {
    expect(() => jsonLogicToUcast({ between: [{ var: 'age' }, 5, 18] })).toThrow(
      'Unsupported JsonLogic operator: "between"',
    );
  });

  it('== with wrong operand count → throws', () => {
    expect(() => jsonLogicToUcast({ '==': [{ var: 'gender' }] })).toThrow('exactly 2 operands');
  });

  it('== with literal left operand (no var) → throws', () => {
    expect(() => jsonLogicToUcast({ '==': ['literal', 'value'] })).toThrow(
      'must be a variable reference',
    );
  });

  it('in with non-array right operand → throws', () => {
    expect(() => jsonLogicToUcast({ in: [{ var: 'gender' }, 'not-array'] })).toThrow(
      'must be an array',
    );
  });

  it('and with non-array operands → throws', () => {
    expect(() => jsonLogicToUcast({ and: 'not-array' })).toThrow('requires an array');
  });

  it('multiple operator keys → throws', () => {
    expect(() =>
      jsonLogicToUcast({ '==': [{ var: 'gender' }, 'f'], '!=': [{ var: 'gender' }, 'm'] }),
    ).toThrow('exactly one operator key');
  });

  it('!! with non-var operand → throws', () => {
    expect(() => jsonLogicToUcast({ '!!': 'not-a-var' })).toThrow(
      'requires a {"var": "..."} operand',
    );
  });
});
