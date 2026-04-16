/**
 * Unit tests for institute-timezone helpers.
 *
 * Verifies that "today" is computed in the institute's local timezone rather
 * than the server's UTC clock — the regression that motivated the helper is
 * a UTC server reporting the wrong calendar day near midnight IST.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInstituteNow, getInstituteToday } from './timezone';

describe('timezone helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getInstituteToday', () => {
    it('returns the next calendar day in Asia/Kolkata when UTC is still on the previous day', () => {
      // 2026-04-15T23:59:59Z = 2026-04-16T05:29:59 IST (UTC+5:30)
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      expect(getInstituteToday({ timezone: 'Asia/Kolkata' })).toBe('2026-04-16');
    });

    it('returns the previous calendar day in America/New_York when UTC has just rolled over', () => {
      // 2026-04-15T23:59:59Z = 2026-04-15T19:59:59 EDT (UTC-4 in April)
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      expect(getInstituteToday({ timezone: 'America/New_York' })).toBe('2026-04-15');
    });

    it('falls back to Asia/Kolkata when the institute timezone is null', () => {
      // Same instant — if the fallback works, Kolkata wins and we get 04-16.
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      expect(getInstituteToday({ timezone: null })).toBe('2026-04-16');
    });

    it('falls back to Asia/Kolkata when the institute timezone is undefined', () => {
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      expect(getInstituteToday({ timezone: undefined })).toBe('2026-04-16');
    });

    it('falls back to Asia/Kolkata when the institute timezone is an empty string', () => {
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      expect(getInstituteToday({ timezone: '' })).toBe('2026-04-16');
    });
  });

  describe('getInstituteNow', () => {
    it('returns a Date whose wall-clock fields reflect institute-local time', () => {
      // 2026-04-15T23:59:59Z → IST wall clock is 2026-04-16 05:29:59
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      const now = getInstituteNow({ timezone: 'Asia/Kolkata' });

      // toZonedTime shifts local (non-UTC) accessors to reflect target timezone
      // wall-clock time. Use getDate/getHours/getMinutes (portable across any
      // machine timezone), NOT getUTCDate/getUTCHours which remain at raw UTC.
      expect(now.getFullYear()).toBe(2026);
      expect(now.getMonth()).toBe(3); // April (0-indexed)
      expect(now.getDate()).toBe(16);
      expect(now.getHours()).toBe(5);
      expect(now.getMinutes()).toBe(29);
    });

    it('falls back to Asia/Kolkata when the institute timezone is missing', () => {
      vi.setSystemTime(new Date('2026-04-15T23:59:59Z'));

      const now = getInstituteNow({ timezone: null });

      // Same assertions as the Kolkata case confirm the fallback took effect.
      expect(now.getDate()).toBe(16);
      expect(now.getHours()).toBe(5);
    });
  });
});
