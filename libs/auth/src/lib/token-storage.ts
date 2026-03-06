import type { AuthTokens, AuthUser, MembershipInfo } from './types';

const ACCESS_TOKEN_KEY = 'roviq_access_token';
const REFRESH_TOKEN_KEY = 'roviq_refresh_token';
const USER_KEY = 'roviq_user';
const PLATFORM_TOKEN_KEY = 'roviq_platform_token';
const MEMBERSHIPS_KEY = 'roviq_memberships';

export const tokenStorage = {
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

  getPlatformToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
  },

  setPlatformToken(token: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
  },

  getMemberships(): MembershipInfo[] | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(MEMBERSHIPS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MembershipInfo[];
    } catch {
      return null;
    }
  },

  setMemberships(memberships: MembershipInfo[]): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));
  },

  clearPlatform(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
    sessionStorage.removeItem(MEMBERSHIPS_KEY);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
    sessionStorage.removeItem(MEMBERSHIPS_KEY);
  },
};
