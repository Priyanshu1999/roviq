import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { optionalInt } from '../form-schemas';

/**
 * Tests for the optionalInt schema.
 *
 * HTML number inputs with `valueAsNumber: true` produce NaN when empty.
 * optionalInt converts NaN to undefined so optional number fields work correctly.
 */

// The broken pattern for reference — NaN fails .int() and .min()
const brokenPattern = z.number().int().min(0).optional();

describe('broken pattern (z.number().int().min(0).optional())', () => {
  it('accepts a valid number', () => {
    expect(brokenPattern.safeParse(100).success).toBe(true);
  });

  it('accepts undefined', () => {
    expect(brokenPattern.safeParse(undefined).success).toBe(true);
  });

  it('FAILS on NaN (empty input with valueAsNumber)', () => {
    const result = brokenPattern.safeParse(NaN);
    expect(result.success).toBe(false);
  });
});

describe('optionalInt (shared helper)', () => {
  it('accepts a valid number', () => {
    const result = optionalInt.safeParse(100);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(100);
  });

  it('accepts undefined', () => {
    const result = optionalInt.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeUndefined();
  });

  it('converts NaN to undefined (empty input)', () => {
    const result = optionalInt.safeParse(NaN);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeUndefined();
  });

  it('accepts zero', () => {
    const result = optionalInt.safeParse(0);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(0);
  });

  it('rejects negative numbers', () => {
    expect(optionalInt.safeParse(-1).success).toBe(false);
  });

  it('rejects floats', () => {
    expect(optionalInt.safeParse(1.5).success).toBe(false);
  });
});
