import { describe, expect, it } from 'vitest';
import { DateRange } from '../date-range.vo';

describe('DateRange', () => {
  const jan1 = new Date('2026-01-01');
  const jan15 = new Date('2026-01-15');
  const feb1 = new Date('2026-02-01');
  const mar1 = new Date('2026-03-01');

  describe('create', () => {
    it('succeeds with start before end', () => {
      const range = DateRange.create(jan1, feb1);
      expect(range.start.getTime()).toBe(jan1.getTime());
      expect(range.end.getTime()).toBe(feb1.getTime());
    });

    it('throws when start equals end', () => {
      expect(() => DateRange.create(jan1, jan1)).toThrow('Start date must be before end date');
    });

    it('throws when start is after end', () => {
      expect(() => DateRange.create(feb1, jan1)).toThrow('Start date must be before end date');
    });

    it('throws for invalid dates', () => {
      expect(() => DateRange.create(new Date('garbage'), jan1)).toThrow('Invalid date');
      expect(() => DateRange.create(jan1, new Date('garbage'))).toThrow('Invalid date');
    });

    it('defensive copies prevent external mutation', () => {
      const original = new Date('2026-01-01');
      const range = DateRange.create(original, feb1);
      original.setFullYear(2000);
      expect(range.start.getFullYear()).toBe(2026);
    });

    it('getters return defensive copies', () => {
      const range = DateRange.create(jan1, feb1);
      range.start.setFullYear(2000);
      expect(range.start.getFullYear()).toBe(2026);
    });
  });

  describe('tryCreate', () => {
    it('returns DateRange for valid input', () => {
      expect(DateRange.tryCreate(jan1, feb1)).not.toBeNull();
    });

    it('returns null for invalid dates', () => {
      expect(DateRange.tryCreate(new Date('garbage'), jan1)).toBeNull();
    });

    it('returns null when start >= end', () => {
      expect(DateRange.tryCreate(feb1, jan1)).toBeNull();
    });
  });

  describe('contains', () => {
    it('returns true for date within range', () => {
      const range = DateRange.create(jan1, feb1);
      expect(range.contains(jan15)).toBe(true);
    });

    it('returns true for start date (inclusive)', () => {
      const range = DateRange.create(jan1, feb1);
      expect(range.contains(jan1)).toBe(true);
    });

    it('returns false for end date (exclusive)', () => {
      const range = DateRange.create(jan1, feb1);
      expect(range.contains(feb1)).toBe(false);
    });
  });

  describe('overlaps', () => {
    it('returns true for overlapping ranges', () => {
      const a = DateRange.create(jan1, feb1);
      const b = DateRange.create(jan15, mar1);
      expect(a.overlaps(b)).toBe(true);
    });

    it('returns false for adjacent ranges', () => {
      const a = DateRange.create(jan1, feb1);
      const b = DateRange.create(feb1, mar1);
      expect(a.overlaps(b)).toBe(false);
    });
  });

  describe('durationDays', () => {
    it('returns correct number of days', () => {
      const range = DateRange.create(jan1, jan15);
      expect(range.durationDays).toBe(14);
    });
  });

  describe('equals', () => {
    it('returns true for same range', () => {
      const a = DateRange.create(jan1, feb1);
      const b = DateRange.create(jan1, feb1);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different ranges', () => {
      const a = DateRange.create(jan1, feb1);
      const b = DateRange.create(jan1, mar1);
      expect(a.equals(b)).toBe(false);
    });
  });
});
