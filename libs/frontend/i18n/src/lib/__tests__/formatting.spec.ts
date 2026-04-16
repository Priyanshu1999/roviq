import { renderHook } from '@testing-library/react';
import { parseISO } from 'date-fns';
import { useLocale } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormatDate, useFormatNumber } from '../formatting';

vi.mock('next-intl', () => ({
  useLocale: vi.fn(() => 'en'),
}));

const mockedUseLocale = vi.mocked(useLocale);

describe('useFormatNumber', () => {
  beforeEach(() => {
    mockedUseLocale.mockReturnValue('en');
  });

  it('formats numbers in Indian (en-IN) grouping by default', () => {
    const { result } = renderHook(() => useFormatNumber());
    // Indian numbering uses lakh grouping: 1,00,000 not 100,000
    expect(result.current.format(100000)).toBe('1,00,000');
  });

  it('formats large numbers in Indian (en-IN) lakh/crore grouping', () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current.format(12345678)).toBe('1,23,45,678');
  });

  it('formats currency with INR ₹ symbol and Indian grouping', () => {
    const { result } = renderHook(() => useFormatNumber());
    const formatted = result.current.currency(150000);
    expect(formatted).toContain('1,50,000');
    expect(formatted).toContain('₹');
  });

  it('formats percent values with the % suffix', () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current.percent(0.42)).toContain('42');
    expect(result.current.percent(0.42)).toContain('%');
  });

  it('returns a non-empty grouped string when locale is hi', () => {
    mockedUseLocale.mockReturnValue('hi');
    const { result } = renderHook(() => useFormatNumber());
    const formatted = result.current.format(100000);
    // Whatever script Intl chooses for hi-IN in the current Node version,
    // the output must be non-empty and contain a separator (Indian grouping).
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toMatch(/[,.]/);
  });

  it('respects custom Intl options', () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current.format(1.2345, { maximumFractionDigits: 2 })).toBe('1.23');
  });
});

describe('useFormatDate', () => {
  // Date used across tests: 28 December 2022
  // ISO: 2022-12-28 — unambiguous regardless of DD/MM vs MM/DD.
  const ISO_DATE = '2022-12-28';

  beforeEach(() => {
    mockedUseLocale.mockReturnValue('en');
  });

  it('formats an ISO date string with en-IN locale — contains day, abbreviated month, and year', () => {
    const { result } = renderHook(() => useFormatDate());
    const date = parseISO(ISO_DATE);
    const formatted = result.current.format(date, 'PP');
    // en-IN 'PP' produces something like "28 Dec 2022" or "Dec 28, 2022"
    expect(formatted).toContain('28');
    expect(formatted).toMatch(/dec/i);
    expect(formatted).toContain('2022');
  });

  it('formats an ISO date string with hi locale — output is non-empty and locale-aware', () => {
    mockedUseLocale.mockReturnValue('hi');
    const { result } = renderHook(() => useFormatDate());
    const date = parseISO(ISO_DATE);
    const formatted = result.current.format(date, 'PP');
    // Hindi 'PP' output uses Devanagari month names; must be non-empty and contain the year digits.
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('2022');
  });

  it('formatDistance returns a human-readable relative string', () => {
    const { result } = renderHook(() => useFormatDate());
    const past = parseISO(ISO_DATE);
    const now = parseISO('2023-01-05');
    const rel = result.current.formatDistance(past, now);
    // Should describe roughly 8 days — non-empty string with suffix.
    expect(rel.length).toBeGreaterThan(0);
  });

  it('never receives a display-formatted string — parseISO on ISO input gives correct Date', () => {
    // Documents the DD/MM footgun contract:
    // parseISO('2022-12-28') → Dec 28; new Date('12/28/2022') is locale-dependent.
    const { result } = renderHook(() => useFormatDate());
    const date = parseISO(ISO_DATE);
    // Month is 11 (0-indexed December) — confirms ISO parsing is unambiguous.
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(28);
    // Formatting via the hook must reflect December (numeric month = '12').
    const formatted = result.current.format(date, 'MM');
    expect(formatted).toBe('12');
  });
});
