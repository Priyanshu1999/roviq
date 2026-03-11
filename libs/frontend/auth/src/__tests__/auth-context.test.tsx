import { act, renderHook, waitFor } from '@testing-library/react';
import type * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { tokenStorage } from '../lib/token-storage';
import type { AuthUser, LoginResult } from '../lib/types';

function createFakeJwt(expUnix: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(
    JSON.stringify({ sub: 'u1', tenantId: 't1', roleId: 'r1', exp: expUnix, iat: 0 }),
  );
  return `${header}.${body}.sig`;
}

const noop = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('should not be called'));

function renderAuth(selectOrgMutation = noop) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider
      loginMutation={
        noop as unknown as (i: { username: string; password: string }) => Promise<LoginResult>
      }
      selectOrgMutation={
        selectOrgMutation as unknown as (
          t: string,
          p: string,
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

describe('selectOrganization with expired platform token', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear auth state and redirect to login instead of showing a generic error', async () => {
    const expiredToken = createFakeJwt(Math.floor(Date.now() / 1000) - 600);
    tokenStorage.setPlatformToken(expiredToken);
    tokenStorage.setMemberships([
      { tenantId: 't1', roleId: 'r1', orgName: 'Org', orgSlug: 'org', roleName: 'admin' },
    ]);

    const selectOrgMutation = vi.fn();
    const { result } = renderAuth(selectOrgMutation);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsOrgSelection).toBe(true);

    // Bug scenario: user clicks an institute after token expired
    let thrownError: Error | undefined;
    await act(async () => {
      try {
        await result.current.selectOrganization('t1');
      } catch (e) {
        thrownError = e as Error;
      }
    });

    expect(thrownError?.message).toBe('Session expired');

    // Auth state must be fully cleared so the select-org page redirects to login
    expect(result.current.needsOrgSelection).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(tokenStorage.getPlatformToken()).toBeNull();

    // Expired token should never reach the backend
    expect(selectOrgMutation).not.toHaveBeenCalled();
  });
});
