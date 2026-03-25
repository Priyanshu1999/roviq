import type { AdmissionNumberConfig } from '@roviq/database';
import { describe, expect, it } from 'vitest';
import { resolveAdmissionPrefix, resolveAdmissionYear } from '../admission-number';

const DEFAULT_CONFIG: AdmissionNumberConfig = {
  format: '{prefix}{year}/{value:04d}',
  year_format: 'YYYY',
  prefixes: { '-3': 'N-', '-2': 'L-', '-1': 'U-', '1': 'A-' },
  no_prefix_from_class: 2,
};

describe('resolveAdmissionPrefix', () => {
  it('Nursery (numeric_order = -3) → "N-"', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, -3)).toBe('N-');
  });

  it('LKG (numeric_order = -2) → "L-"', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, -2)).toBe('L-');
  });

  it('UKG (numeric_order = -1) → "U-"', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, -1)).toBe('U-');
  });

  it('Class 1 (numeric_order = 1) → "A-"', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, 1)).toBe('A-');
  });

  it('Class 2 (numeric_order = 2, >= no_prefix_from_class) → ""', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, 2)).toBe('');
  });

  it('Class 5 (numeric_order = 5, >= no_prefix_from_class) → ""', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, 5)).toBe('');
  });

  it('Class 10 (numeric_order = 10) → ""', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, 10)).toBe('');
  });

  it('numeric_order = 0 (no mapping) → ""', () => {
    expect(resolveAdmissionPrefix(DEFAULT_CONFIG, 0)).toBe('');
  });

  it('empty prefixes map → always ""', () => {
    const config: AdmissionNumberConfig = {
      ...DEFAULT_CONFIG,
      prefixes: {},
    };
    expect(resolveAdmissionPrefix(config, -3)).toBe('');
    expect(resolveAdmissionPrefix(config, 1)).toBe('');
  });
});

describe('resolveAdmissionYear', () => {
  it('YYYY format in June 2025 → "2025"', () => {
    const date = new Date('2025-06-15');
    expect(resolveAdmissionYear(DEFAULT_CONFIG, date)).toBe('2025');
  });

  it('YYYY format in January 2026 (before April) → "2025" (Indian academic year)', () => {
    const date = new Date('2026-01-15');
    expect(resolveAdmissionYear(DEFAULT_CONFIG, date)).toBe('2025');
  });

  it('YYYY format in April 2026 → "2026"', () => {
    const date = new Date('2026-04-01');
    expect(resolveAdmissionYear(DEFAULT_CONFIG, date)).toBe('2026');
  });

  it('YY-YY format in June 2025 → "25-26"', () => {
    const config: AdmissionNumberConfig = { ...DEFAULT_CONFIG, year_format: 'YY-YY' };
    const date = new Date('2025-06-15');
    expect(resolveAdmissionYear(config, date)).toBe('25-26');
  });

  it('YY-YY format in December 2099 → "99-00"', () => {
    const config: AdmissionNumberConfig = { ...DEFAULT_CONFIG, year_format: 'YY-YY' };
    const date = new Date('2099-12-01');
    expect(resolveAdmissionYear(config, date)).toBe('99-00');
  });
});
