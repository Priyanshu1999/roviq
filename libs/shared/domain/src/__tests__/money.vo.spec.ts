import { describe, expect, it } from 'vitest';
import { Money } from '../value-objects/money.vo';

describe('Money', () => {
  describe('create', () => {
    it('succeeds with valid amount and currency', () => {
      const money = Money.create(1000, 'INR');
      expect(money.amount).toBe(1000);
      expect(money.currency).toBe('INR');
    });

    it('succeeds with zero amount', () => {
      const money = Money.create(0, 'INR');
      expect(money.amount).toBe(0);
      expect(money.currency).toBe('INR');
    });

    it('throws for negative amount', () => {
      expect(() => Money.create(-1, 'INR')).toThrow(
        'Amount must be a non-negative integer (minor units)',
      );
    });

    it('throws for non-integer amount', () => {
      expect(() => Money.create(1.5, 'INR')).toThrow(
        'Amount must be a non-negative integer (minor units)',
      );
    });

    it('throws for lowercase currency', () => {
      expect(() => Money.create(1000, 'inr')).toThrow('Currency must be a 3-letter ISO 4217 code');
    });

    it('throws for currency shorter than 3 characters', () => {
      expect(() => Money.create(1000, 'IN')).toThrow('Currency must be a 3-letter ISO 4217 code');
    });
  });

  describe('equals', () => {
    it('returns true for same amount and currency', () => {
      const a = Money.create(1000, 'INR');
      const b = Money.create(1000, 'INR');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different amount', () => {
      const a = Money.create(1000, 'INR');
      const b = Money.create(2000, 'INR');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false for different currency', () => {
      const a = Money.create(1000, 'INR');
      const b = Money.create(1000, 'USD');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('format', () => {
    it('returns a formatted currency string', () => {
      const money = Money.create(150000, 'INR');
      const formatted = money.format();
      // 150000 minor units = 1500.00 INR
      expect(formatted).toContain('1,500');
    });
  });
});
