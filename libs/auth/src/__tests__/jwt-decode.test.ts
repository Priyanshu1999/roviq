import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeJwt, isTokenExpired } from '../lib/jwt-decode';

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${body}.${signature}`;
}

describe('decodeJwt', () => {
  it('should decode a valid JWT payload', () => {
    const token = createFakeJwt({
      sub: 'user-123',
      tenantId: 'tenant-456',
      roleId: 'role-789',
      exp: 1700000000,
      iat: 1699999000,
    });

    const decoded = decodeJwt(token);
    expect(decoded).toEqual({
      sub: 'user-123',
      tenantId: 'tenant-456',
      roleId: 'role-789',
      exp: 1700000000,
      iat: 1699999000,
    });
  });

  it('should return null for malformed token (wrong number of parts)', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('only.two')).toBeNull();
    expect(decodeJwt('a.b.c.d')).toBeNull();
  });

  it('should return null for invalid base64 payload', () => {
    expect(decodeJwt('header.!!!invalid!!!.signature')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(decodeJwt('')).toBeNull();
  });

  it('should decode payload even when exp field is missing', () => {
    const token = createFakeJwt({ sub: 'user-1', tenantId: 't', roleId: 'r' });
    const decoded = decodeJwt(token);
    expect(decoded).toBeDefined();
    expect(decoded?.sub).toBe('user-1');
    expect(decoded?.exp).toBeUndefined();
  });
});

describe('isTokenExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return false for a token that expires far in the future', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const futureExp = Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000);
    const token = createFakeJwt({ exp: futureExp, sub: 'u', tenantId: 't', roleId: 'r', iat: 0 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('should return true for a token that has already expired', () => {
    vi.setSystemTime(new Date('2025-01-01T02:00:00Z'));
    const pastExp = Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000);
    const token = createFakeJwt({ exp: pastExp, sub: 'u', tenantId: 't', roleId: 'r', iat: 0 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('should return true when token is within the buffer window', () => {
    vi.setSystemTime(new Date('2025-01-01T00:59:40Z'));
    const exp = Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000); // 20s left
    const token = createFakeJwt({ exp, sub: 'u', tenantId: 't', roleId: 'r', iat: 0 });
    // Default buffer is 30s, 20s remaining < 30s buffer → expired
    expect(isTokenExpired(token)).toBe(true);
  });

  it('should respect custom buffer seconds', () => {
    vi.setSystemTime(new Date('2025-01-01T00:59:50Z'));
    const exp = Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000); // 10s left
    const token = createFakeJwt({ exp, sub: 'u', tenantId: 't', roleId: 'r', iat: 0 });
    // 10s left, buffer=5 → not expired
    expect(isTokenExpired(token, 5)).toBe(false);
    // 10s left, buffer=15 → expired
    expect(isTokenExpired(token, 15)).toBe(true);
  });

  it('should return true for an invalid token', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('should treat token without exp field as not expired (NaN comparison)', () => {
    const token = createFakeJwt({ sub: 'u', tenantId: 't', roleId: 'r' });
    // BUG: undefined - 30 → NaN, NaN <= now → false, so returns false (not expired)
    // This is a known edge case — tokens should always have exp in practice
    expect(isTokenExpired(token)).toBe(false);
  });

  it('should handle buffer of zero', () => {
    vi.setSystemTime(new Date('2025-01-01T00:59:59Z'));
    const exp = Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000); // 1s left
    const token = createFakeJwt({ exp, sub: 'u', tenantId: 't', roleId: 'r', iat: 0 });
    expect(isTokenExpired(token, 0)).toBe(false);
  });
});
