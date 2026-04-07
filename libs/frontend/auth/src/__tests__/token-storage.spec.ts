import { beforeEach, describe, expect, it } from 'vitest';
import { createScopedTokenStorage } from '../lib/token-storage';
import type { AuthUser, MembershipInfo } from '../lib/types';

const mockUser: AuthUser = {
  id: 'u1',
  username: 'admin',
  email: 'a@b.com',
  scope: 'institute',
  tenantId: 't1',
  roleId: 'r1',
};

const mockMemberships: MembershipInfo[] = [
  {
    membershipId: 'm1',
    tenantId: 't1',
    roleId: 'r1',
    instituteName: { en: 'Institute 1' },
    instituteSlug: 'institute-1',
    roleName: { en: 'admin' },
  },
  {
    membershipId: 'm2',
    tenantId: 't2',
    roleId: 'r2',
    instituteName: { en: 'Institute 2' },
    instituteSlug: 'institute-2',
    roleName: { en: 'teacher' },
  },
];

describe('createScopedTokenStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('tokens', () => {
    it('stores and retrieves access and refresh tokens', () => {
      const storage = createScopedTokenStorage('institute');
      storage.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
      expect(storage.getAccessToken()).toBe('access-1');
      expect(storage.getRefreshToken()).toBe('refresh-1');
    });

    it('returns null when no tokens are set', () => {
      const storage = createScopedTokenStorage('institute');
      expect(storage.getAccessToken()).toBeNull();
      expect(storage.getRefreshToken()).toBeNull();
    });
  });

  describe('user', () => {
    it('stores and retrieves user object', () => {
      const storage = createScopedTokenStorage('institute');
      storage.setUser(mockUser);
      expect(storage.getUser()).toEqual(mockUser);
    });

    it('returns null when no user is set', () => {
      const storage = createScopedTokenStorage('institute');
      expect(storage.getUser()).toBeNull();
    });

    it('returns null for invalid JSON in storage', () => {
      localStorage.setItem('roviq-institute-user', '{invalid json');
      const storage = createScopedTokenStorage('institute');
      expect(storage.getUser()).toBeNull();
    });
  });

  describe('memberships', () => {
    it('stores and retrieves memberships', () => {
      const storage = createScopedTokenStorage('institute');
      storage.setMemberships(mockMemberships);
      expect(storage.getMemberships()).toEqual(mockMemberships);
    });

    it('returns null when no memberships are set', () => {
      const storage = createScopedTokenStorage('institute');
      expect(storage.getMemberships()).toBeNull();
    });

    it('returns null for invalid JSON in storage', () => {
      sessionStorage.setItem('roviq-institute-memberships', 'not-json');
      const storage = createScopedTokenStorage('institute');
      expect(storage.getMemberships()).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes all stored data', () => {
      const storage = createScopedTokenStorage('institute');
      storage.setTokens({ accessToken: 'a', refreshToken: 'r' });
      storage.setUser(mockUser);
      storage.setMemberships(mockMemberships);

      storage.clear();

      expect(storage.getAccessToken()).toBeNull();
      expect(storage.getRefreshToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getMemberships()).toBeNull();
    });
  });

  describe('clearMemberships', () => {
    it('removes memberships but keeps access/refresh tokens', () => {
      const storage = createScopedTokenStorage('institute');
      storage.setTokens({ accessToken: 'a', refreshToken: 'r' });
      storage.setMemberships(mockMemberships);

      storage.clearMemberships();

      expect(storage.getMemberships()).toBeNull();
      expect(storage.getAccessToken()).toBe('a');
      expect(storage.getRefreshToken()).toBe('r');
    });
  });

  describe('scope isolation', () => {
    it('isolates tokens by scope', () => {
      const platformStorage = createScopedTokenStorage('platform');
      const instituteStorage = createScopedTokenStorage('institute');

      platformStorage.setTokens({
        accessToken: 'platform-access',
        refreshToken: 'platform-refresh',
      });
      instituteStorage.setTokens({
        accessToken: 'institute-access',
        refreshToken: 'institute-refresh',
      });

      expect(platformStorage.getAccessToken()).toBe('platform-access');
      expect(instituteStorage.getAccessToken()).toBe('institute-access');
    });

    it('isolates user data by scope', () => {
      const platformStorage = createScopedTokenStorage('platform');
      const resellerStorage = createScopedTokenStorage('reseller');

      const platformUser = { ...mockUser, scope: 'platform' as const };
      const resellerUser = { ...mockUser, scope: 'reseller' as const, id: 'u2' };

      platformStorage.setUser(platformUser);
      resellerStorage.setUser(resellerUser);

      expect(platformStorage.getUser()).toEqual(platformUser);
      expect(resellerStorage.getUser()).toEqual(resellerUser);
    });

    it('clearing one scope does not affect another', () => {
      const platformStorage = createScopedTokenStorage('platform');
      const instituteStorage = createScopedTokenStorage('institute');

      platformStorage.setTokens({ accessToken: 'pa', refreshToken: 'pr' });
      instituteStorage.setTokens({ accessToken: 'ia', refreshToken: 'ir' });

      platformStorage.clear();

      expect(platformStorage.getAccessToken()).toBeNull();
      expect(instituteStorage.getAccessToken()).toBe('ia');
    });
  });
});
