import { describe, expect, it } from 'vitest';
import { BillingPeriod } from '../value-objects/billing-period.vo';

describe('BillingPeriod', () => {
  describe('fromInterval', () => {
    it('adds 1 month for MONTHLY interval', () => {
      const start = new Date('2026-01-15');
      const period = BillingPeriod.fromInterval(start, 'MONTHLY');
      expect(period.start).toEqual(new Date('2026-01-15'));
      expect(period.end).toEqual(new Date('2026-02-15'));
    });

    it('adds 3 months for QUARTERLY interval', () => {
      const start = new Date('2026-01-15');
      const period = BillingPeriod.fromInterval(start, 'QUARTERLY');
      expect(period.start).toEqual(new Date('2026-01-15'));
      expect(period.end).toEqual(new Date('2026-04-15'));
    });

    it('adds 1 year for YEARLY interval', () => {
      const start = new Date('2026-01-15');
      const period = BillingPeriod.fromInterval(start, 'ANNUAL');
      expect(period.start).toEqual(new Date('2026-01-15'));
      expect(period.end).toEqual(new Date('2027-01-15'));
    });

    it('clamps MONTHLY from Jan 31 to Feb 28 in a non-leap year', () => {
      const start = new Date('2026-01-31');
      const period = BillingPeriod.fromInterval(start, 'MONTHLY');
      expect(period.end).toEqual(new Date('2026-02-28'));
    });

    it('clamps MONTHLY from Jan 31 to Feb 29 in a leap year', () => {
      const start = new Date('2028-01-31');
      const period = BillingPeriod.fromInterval(start, 'MONTHLY');
      expect(period.end).toEqual(new Date('2028-02-29'));
    });

    it('clamps MONTHLY from Mar 31 to Apr 30', () => {
      const start = new Date('2026-03-31');
      const period = BillingPeriod.fromInterval(start, 'MONTHLY');
      expect(period.end).toEqual(new Date('2026-04-30'));
    });

    it('clamps QUARTERLY from Nov 30 to Feb 28 in a non-leap year', () => {
      const start = new Date('2025-11-30');
      const period = BillingPeriod.fromInterval(start, 'QUARTERLY');
      expect(period.end).toEqual(new Date('2026-02-28'));
    });

    it('clamps QUARTERLY from Nov 30 to Feb 29 in a leap year', () => {
      const start = new Date('2027-11-30');
      const period = BillingPeriod.fromInterval(start, 'QUARTERLY');
      expect(period.end).toEqual(new Date('2028-02-29'));
    });
  });

  describe('contains', () => {
    const period = BillingPeriod.fromInterval(new Date('2026-03-01'), 'MONTHLY');

    it('returns true for a date within the period', () => {
      expect(period.contains(new Date('2026-03-15'))).toBe(true);
    });

    it('returns true for the start date (inclusive)', () => {
      expect(period.contains(new Date('2026-03-01'))).toBe(true);
    });

    it('returns false for a date before the period', () => {
      expect(period.contains(new Date('2026-02-28'))).toBe(false);
    });

    it('returns false for the end date (exclusive)', () => {
      expect(period.contains(new Date('2026-04-01'))).toBe(false);
    });
  });
});
