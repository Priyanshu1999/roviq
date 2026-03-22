import { renderHook, waitFor } from '@testing-library/react';
import type * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { createScopedTokenStorage } from '../lib/token-storage';
import type { AuthUser, LoginResult } from '../lib/types';

function createFakeJwt(expUnix: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(
    JSON.stringify({ sub: 'u1', tenantId: 't1', roleId: 'r1', exp: expUnix, iat: 0 }),
  );
  return `${header}.${body}.sig`;
}

const noop = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('should not be called'));

function renderAuth(
  selectInstituteMutation = noop,
  scope: 'platform' | 'reseller' | 'institute' = 'institute',
) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider
      scope={scope}
      loginMutation={
        noop as unknown as (i: { username: string; password: string }) => Promise<LoginResult>
      }
      selectInstituteMutation={
        selectInstituteMutation as unknown as (
          selectionToken: string,
          membershipId: string,
        ) => Promise<{ accessToken: string; refreshToken: string; user: AuthUser }>
      }
      refreshMutation={
        noop as unknown as (
          r: string,
        ) => Promise<{ accessToken: string; refreshToken: string; user: AuthUser }>
      }
      logoutMutation={vi.fn().mockResolvedValue(undefined)}
    >
      {children}
    </AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

describe('selectInstitute with expired platform token', () => {
  const tokenStorage = createScopedTokenStorage('institute');

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear auth state when tokens expire and refresh fails', async () => {
    const expiredToken = createFakeJwt(Math.floor(Date.now() / 1000) - 600);
    tokenStorage.setTokens({ accessToken: expiredToken, refreshToken: 'refresh-1' });

    const selectInstituteMutation = vi.fn();
    const { result } = renderAuth(selectInstituteMutation);

    // Expired access + failed refresh → fully cleared, user must re-login
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.needsInstituteSelection).toBe(false);
    expect(tokenStorage.getAccessToken()).toBeNull();

    // Expired token should never reach the backend
    expect(selectInstituteMutation).not.toHaveBeenCalled();
  });
});

describe('scope prop', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should expose the scope value from the provider', async () => {
    const { result } = renderAuth(noop, 'platform');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.scope).toBe('platform');
  });

  it('should default scope to institute', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.scope).toBe('institute');
  });
});

describe('isImpersonated', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be false when not authenticated', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isImpersonated).toBe(false);
  });
});
