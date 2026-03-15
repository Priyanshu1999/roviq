import { describe, expect, it } from 'vitest';
import { FeatureLimits } from '../feature-limits.vo';

describe('FeatureLimits', () => {
  describe('create', () => {
    it('succeeds with valid limits', () => {
      const limits = FeatureLimits.create({ maxUsers: 50, maxSections: 10 });
      expect(limits.maxUsers).toBe(50);
      expect(limits.maxSections).toBe(10);
      expect(limits.maxStorageGb).toBeUndefined();
    });

    it('succeeds with empty object', () => {
      const limits = FeatureLimits.create({});
      expect(limits.maxUsers).toBeUndefined();
    });

    it('throws for unknown key', () => {
      expect(() => FeatureLimits.create({ bogus: 1 })).toThrow('Unknown limit key: bogus');
    });

    it('throws for negative value', () => {
      expect(() => FeatureLimits.create({ maxUsers: -1 })).toThrow(
        'maxUsers must be a non-negative integer',
      );
    });

    it('throws for non-integer value', () => {
      expect(() => FeatureLimits.create({ maxUsers: 1.5 })).toThrow(
        'maxUsers must be a non-negative integer',
      );
    });
  });

  describe('tryCreate', () => {
    it('returns FeatureLimits for valid input', () => {
      const limits = FeatureLimits.tryCreate({ maxUsers: 10 });
      expect(limits).not.toBeNull();
      expect(limits!.maxUsers).toBe(10);
    });

    it('returns null for invalid input', () => {
      expect(FeatureLimits.tryCreate({ bogus: 1 })).toBeNull();
    });
  });

  describe('empty', () => {
    it('creates a limits object with no constraints', () => {
      const limits = FeatureLimits.empty();
      expect(limits.maxUsers).toBeUndefined();
      expect(limits.maxSections).toBeUndefined();
      expect(limits.maxStorageGb).toBeUndefined();
    });
  });

  describe('isWithin', () => {
    it('returns true when usage is under the limit', () => {
      const limits = FeatureLimits.create({ maxUsers: 50 });
      expect(limits.isWithin('maxUsers', 30)).toBe(true);
    });

    it('returns true when usage equals the limit', () => {
      const limits = FeatureLimits.create({ maxUsers: 50 });
      expect(limits.isWithin('maxUsers', 50)).toBe(true);
    });

    it('returns false when usage exceeds the limit', () => {
      const limits = FeatureLimits.create({ maxUsers: 50 });
      expect(limits.isWithin('maxUsers', 51)).toBe(false);
    });

    it('returns true when limit is not set (unlimited)', () => {
      const limits = FeatureLimits.empty();
      expect(limits.isWithin('maxUsers', 9999)).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('returns a plain object copy', () => {
      const limits = FeatureLimits.create({ maxUsers: 50, maxStorageGb: 100 });
      const json = limits.toJSON();
      expect(json).toEqual({ maxUsers: 50, maxStorageGb: 100 });
    });
  });

  describe('equals', () => {
    it('returns true for same limits', () => {
      const a = FeatureLimits.create({ maxUsers: 50 });
      const b = FeatureLimits.create({ maxUsers: 50 });
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different limits', () => {
      const a = FeatureLimits.create({ maxUsers: 50 });
      const b = FeatureLimits.create({ maxUsers: 100 });
      expect(a.equals(b)).toBe(false);
    });

    it('treats undefined and missing keys as equal', () => {
      const a = FeatureLimits.create({});
      const b = FeatureLimits.empty();
      expect(a.equals(b)).toBe(true);
    });
  });
});
