import { renderHook } from '@testing-library/react';
import { useLocale } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useI18nField } from '../use-i18n-field';

vi.mock('next-intl', () => ({
  useLocale: vi.fn(() => 'en'),
}));

const mockedUseLocale = vi.mocked(useLocale);

describe('useI18nField', () => {
  beforeEach(() => {
    mockedUseLocale.mockReturnValue('en');
  });

  it('resolves the current locale value', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current({ en: 'Science', hi: 'विज्ञान' })).toBe('Science');
  });

  it('falls back to default locale (en) when current locale missing', () => {
    mockedUseLocale.mockReturnValue('hi');
    const { result } = renderHook(() => useI18nField());
    expect(result.current({ en: 'Science' })).toBe('Science');
  });

  it('falls back to first available value when neither current nor default present', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current({ ta: 'அறிவியல்' })).toBe('அறிவியல்');
  });

  it('returns empty string for null', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current(undefined)).toBe('');
  });

  it('returns empty string for empty object', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current({})).toBe('');
  });

  it('returns plain string as-is (backwards compat)', () => {
    const { result } = renderHook(() => useI18nField());
    expect(result.current('Plain string')).toBe('Plain string');
  });

  it('prefers Hindi when locale is hi', () => {
    mockedUseLocale.mockReturnValue('hi');
    const { result } = renderHook(() => useI18nField());
    expect(result.current({ en: 'Science', hi: 'विज्ञान' })).toBe('विज्ञान');
  });
});
