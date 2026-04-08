import { renderHook } from '@testing-library/react';
import { useLocale } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormatNumber } from '../formatting';

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
