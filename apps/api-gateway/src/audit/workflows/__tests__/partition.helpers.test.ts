import { describe, expect, it } from 'vitest';
import {
  getMonthAfterNextStart,
  getNextMonthStart,
  getPartitionName,
  getRetentionCutoff,
  parsePartitionDate,
} from '../partition.helpers';

describe('getNextMonthStart', () => {
  it('March → April', () => {
    const result = getNextMonthStart(new Date('2026-03-25T10:00:00Z'));
    expect(result.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('December → January (year rollover)', () => {
    const result = getNextMonthStart(new Date('2026-12-25T10:00:00Z'));
    expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('January → February', () => {
    const result = getNextMonthStart(new Date('2026-01-15T10:00:00Z'));
    expect(result.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('getMonthAfterNextStart', () => {
  it('March → May', () => {
    const result = getMonthAfterNextStart(new Date('2026-03-25T10:00:00Z'));
    expect(result.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('November → January (year rollover)', () => {
    const result = getMonthAfterNextStart(new Date('2026-11-25T10:00:00Z'));
    expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('December → February (year rollover)', () => {
    const result = getMonthAfterNextStart(new Date('2026-12-25T10:00:00Z'));
    expect(result.toISOString()).toBe('2027-02-01T00:00:00.000Z');
  });
});

describe('getPartitionName', () => {
  it('generates correct name for April 2026', () => {
    expect(getPartitionName(new Date('2026-04-01T00:00:00Z'))).toBe('audit_logs_2026_04');
  });

  it('generates correct name for January 2027', () => {
    expect(getPartitionName(new Date('2027-01-01T00:00:00Z'))).toBe('audit_logs_2027_01');
  });

  it('pads single-digit months', () => {
    expect(getPartitionName(new Date('2026-01-01T00:00:00Z'))).toBe('audit_logs_2026_01');
    expect(getPartitionName(new Date('2026-09-01T00:00:00Z'))).toBe('audit_logs_2026_09');
  });

  it('handles December', () => {
    expect(getPartitionName(new Date('2026-12-01T00:00:00Z'))).toBe('audit_logs_2026_12');
  });
});

describe('getRetentionCutoff', () => {
  it('365 days from March 25 → ~March of previous year', () => {
    const cutoff = getRetentionCutoff(new Date('2026-03-25T10:00:00Z'), 365);
    // Rounds down to first of month
    expect(cutoff.toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });

  it('90 days from March 25 → December of previous year', () => {
    const cutoff = getRetentionCutoff(new Date('2026-03-25T10:00:00Z'), 90);
    expect(cutoff.toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  it('1095 days (3 years) retention', () => {
    const cutoff = getRetentionCutoff(new Date('2026-03-25T10:00:00Z'), 1095);
    expect(cutoff.toISOString()).toBe('2023-03-01T00:00:00.000Z');
  });
});

describe('parsePartitionDate', () => {
  it('parses valid partition name', () => {
    const date = parsePartitionDate('audit_logs_2025_02');
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2025-02-01T00:00:00.000Z');
  });

  it('parses January correctly', () => {
    const date = parsePartitionDate('audit_logs_2027_01');
    expect(date?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns null for invalid format', () => {
    expect(parsePartitionDate('audit_logs_pkey')).toBeNull();
    expect(parsePartitionDate('some_other_table')).toBeNull();
    expect(parsePartitionDate('audit_logs_2026')).toBeNull();
  });

  it('returns null for non-partition audit_logs objects', () => {
    expect(parsePartitionDate('audit_logs')).toBeNull();
    expect(parsePartitionDate('audit_logs_pkey1')).toBeNull();
  });
});
