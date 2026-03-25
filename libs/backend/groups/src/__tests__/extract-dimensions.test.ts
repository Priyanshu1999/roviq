/**
 * Unit tests for extractDimensions (ROV-163).
 * Tests dimension extraction from JsonLogic rules for cache invalidation.
 */
import { describe, expect, it } from 'vitest';
import { extractDimensions } from '../extract-dimensions';

describe('extractDimensions', () => {
  it('single dimension', () => {
    expect(extractDimensions({ '==': [{ var: 'gender' }, 'female'] })).toEqual(['gender']);
  });

  it('multiple dimensions from AND', () => {
    const dims = extractDimensions({
      and: [
        { '==': [{ var: 'gender' }, 'female'] },
        { in: [{ var: 'social_category' }, ['sc', 'st']] },
        { '==': [{ var: 'standard_id' }, 'uuid'] },
      ],
    });
    expect(dims).toContain('gender');
    expect(dims).toContain('social_category');
    expect(dims).toContain('standard_id');
    expect(dims).toHaveLength(3);
  });

  it('deduplicates dimensions', () => {
    const dims = extractDimensions({
      and: [{ '==': [{ var: 'gender' }, 'female'] }, { '!=': [{ var: 'gender' }, 'other'] }],
    });
    expect(dims).toEqual(['gender']);
  });

  it('deeply nested rules', () => {
    const dims = extractDimensions({
      and: [
        { or: [{ '==': [{ var: 'is_bpl' }, true] }, { '==': [{ var: 'is_cwsn' }, true] }] },
        { '==': [{ var: 'section_id' }, 'uuid'] },
      ],
    });
    expect(dims).toContain('is_bpl');
    expect(dims).toContain('is_cwsn');
    expect(dims).toContain('section_id');
    expect(dims).toHaveLength(3);
  });

  it('empty rule → empty array', () => {
    expect(extractDimensions({})).toEqual([]);
  });

  it('! (not) extracts inner dimensions', () => {
    expect(extractDimensions({ '!': { '==': [{ var: 'academic_status' }, 'expelled'] } })).toEqual([
      'academic_status',
    ]);
  });

  it('!! (truthy) extracts dimension', () => {
    expect(extractDimensions({ '!!': [{ var: 'is_cwsn' }] })).toEqual(['is_cwsn']);
  });
});
