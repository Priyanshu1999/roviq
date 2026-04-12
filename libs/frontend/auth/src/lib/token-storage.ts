import type { AuthScope, AuthTokens, AuthUser, MembershipInfo } from './types';

function scopeKey(scope: AuthScope, suffix: string): string {
  return `roviq-${scope}-${suffix}`;
}

export function createScopedTokenStorage(scope: AuthScope) {
  const ACCESS_TOKEN_KEY = scopeKey(scope, 'access-token');
  const REFRESH_TOKEN_KEY = scopeKey(scope, 'refresh-token');
  const USER_KEY = scopeKey(scope, 'user');
  const MEMBERSHIPS_KEY = scopeKey(scope, 'memberships');

  return {
    getAccessToken(): string | null {
      if (typeof window === 'undefined') return null;
      return sessionStorage.getItem(ACCESS_TOKEN_KEY);
    },

    getRefreshToken(): string | null {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    },

    setTokens(tokens: AuthTokens): void {
      if (typeof window === 'undefined') return;
      sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    },

    getUser(): AuthUser | null {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as AuthUser;
      } catch {
        return null;
      }
    },

    setUser(user: AuthUser): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    getMemberships(): MembershipInfo[] | null {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(MEMBERSHIPS_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as MembershipInfo[];
      } catch {
        return null;
      }
    },

    setMemberships(memberships: MembershipInfo[]): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));
    },

    clearMemberships(): void {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(MEMBERSHIPS_KEY);
    },

    clear(): void {
      if (typeof window === 'undefined') return;
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MEMBERSHIPS_KEY);
    },
  };
}
