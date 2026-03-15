import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../email-address.vo';

describe('EmailAddress', () => {
  describe('create', () => {
    it('normalises to lowercase and trims whitespace', () => {
      const email = EmailAddress.create('  User@Example.COM  ');
      expect(email.value).toBe('user@example.com');
    });

    it('throws for missing @', () => {
      expect(() => EmailAddress.create('not-an-email')).toThrow('Invalid email address');
    });

    it('throws for empty string', () => {
      expect(() => EmailAddress.create('')).toThrow('Invalid email address');
    });

    it('throws for spaces-only input', () => {
      expect(() => EmailAddress.create('   ')).toThrow('Invalid email address');
    });
  });

  describe('tryCreate', () => {
    it('returns EmailAddress for valid input', () => {
      const email = EmailAddress.tryCreate('admin@roviq.com');
      expect(email).not.toBeNull();
      expect(email!.value).toBe('admin@roviq.com');
    });

    it('returns null for invalid input', () => {
      expect(EmailAddress.tryCreate('bad')).toBeNull();
    });
  });

  describe('domain', () => {
    it('extracts domain from email', () => {
      const email = EmailAddress.create('user@roviq.com');
      expect(email.domain).toBe('roviq.com');
    });
  });

  describe('equals', () => {
    it('returns true for same normalised email', () => {
      const a = EmailAddress.create('User@Example.com');
      const b = EmailAddress.create('user@example.com');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different emails', () => {
      const a = EmailAddress.create('a@example.com');
      const b = EmailAddress.create('b@example.com');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the normalised email string', () => {
      const email = EmailAddress.create('Admin@Roviq.COM');
      expect(email.toString()).toBe('admin@roviq.com');
    });
  });
});
