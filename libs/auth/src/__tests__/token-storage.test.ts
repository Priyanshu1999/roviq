import { beforeEach, describe, expect, it } from 'vitest';
import { tokenStorage } from '../lib/token-storage';
import type { AuthUser, MembershipInfo } from '../lib/types';

const mockUser: AuthUser = {
  id: 'u1',
  username: 'admin',
  email: 'a@b.com',
  tenantId: 't1',
  roleId: 'r1',
};

const mockMemberships: MembershipInfo[] = [
  { tenantId: 't1', roleId: 'r1', orgName: 'Org 1', orgSlug: 'org-1', roleName: 'admin' },
  { tenantId: 't2', roleId: 'r2', orgName: 'Org 2', orgSlug: 'org-2', roleName: 'teacher' },
];

describe('tokenStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('tokens', () => {
    it('stores and retrieves access and refresh tokens', () => {
      tokenStorage.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
      expect(tokenStorage.getAccessToken()).toBe('access-1');
      expect(tokenStorage.getRefreshToken()).toBe('refresh-1');
    });

    it('returns null when no tokens are set', () => {
      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();
    });
  });

  describe('user', () => {
    it('stores and retrieves user object', () => {
      tokenStorage.setUser(mockUser);
      expect(tokenStorage.getUser()).toEqual(mockUser);
    });

    it('returns null when no user is set', () => {
      expect(tokenStorage.getUser()).toBeNull();
    });

    it('returns null for invalid JSON in storage', () => {
      localStorage.setItem('roviq_user', '{invalid json');
      expect(tokenStorage.getUser()).toBeNull();
    });
  });

  describe('platform token', () => {
    it('stores and retrieves platform token', () => {
      tokenStorage.setPlatformToken('platform-123');
      expect(tokenStorage.getPlatformToken()).toBe('platform-123');
    });

    it('returns null when no platform token is set', () => {
      expect(tokenStorage.getPlatformToken()).toBeNull();
    });
  });

  describe('memberships', () => {
    it('stores and retrieves memberships', () => {
      tokenStorage.setMemberships(mockMemberships);
      expect(tokenStorage.getMemberships()).toEqual(mockMemberships);
    });

    it('returns null when no memberships are set', () => {
      expect(tokenStorage.getMemberships()).toBeNull();
    });

    it('returns null for invalid JSON in storage', () => {
      sessionStorage.setItem('roviq_memberships', 'not-json');
      expect(tokenStorage.getMemberships()).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes all stored data', () => {
      tokenStorage.setTokens({ accessToken: 'a', refreshToken: 'r' });
      tokenStorage.setUser(mockUser);
      tokenStorage.setPlatformToken('p');
      tokenStorage.setMemberships(mockMemberships);

      tokenStorage.clear();

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();
      expect(tokenStorage.getUser()).toBeNull();
      expect(tokenStorage.getPlatformToken()).toBeNull();
      expect(tokenStorage.getMemberships()).toBeNull();
    });
  });

  describe('clearPlatform', () => {
    it('removes platform token and memberships but keeps access/refresh tokens', () => {
      tokenStorage.setTokens({ accessToken: 'a', refreshToken: 'r' });
      tokenStorage.setPlatformToken('p');
      tokenStorage.setMemberships(mockMemberships);

      tokenStorage.clearPlatform();

      expect(tokenStorage.getPlatformToken()).toBeNull();
      expect(tokenStorage.getMemberships()).toBeNull();
      expect(tokenStorage.getAccessToken()).toBe('a');
      expect(tokenStorage.getRefreshToken()).toBe('r');
    });
  });
});
