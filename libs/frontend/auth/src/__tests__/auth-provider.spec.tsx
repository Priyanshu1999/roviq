import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../lib/auth-context';
import type { AuthUser, LoginResult, MembershipInfo } from '../lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal but structurally valid JWT that isTokenExpired() will accept.
 * Not cryptographically signed — tests only need the payload to decode correctly.
 */
function makeJwt(exp: number, extras: Record<string, unknown> = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub: 'u1', tenantId: 't1', roleId: 'r1', exp, iat: exp - 900, ...extras }),
  );
  return `${header}.${payload}.fake-sig`;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600; // expires in 1 hour
const PAST = Math.floor(Date.now() / 1000) - 3600; // expired 1 hour ago

const MOCK_USER: AuthUser = {
  id: 'u1',
  username: 'priya.admin',
  email: 'priya@example.com',
  scope: 'institute',
  tenantId: 't1',
  roleId: 'r1',
};

const MOCK_MEMBERSHIPS: MembershipInfo[] = [
  {
    membershipId: 'm1',
    tenantId: 't1',
    roleId: 'r1',
    instituteName: { en: 'Sunrise Academy' },
    instituteSlug: 'sunrise',
    roleName: { en: 'Admin' },
  },
  {
    membershipId: 'm2',
    tenantId: 't2',
    roleId: 'r2',
    instituteName: { en: 'City College' },
    instituteSlug: 'city',
    roleName: { en: 'Teacher' },
  },
];

// ── Default no-op mutations ───────────────────────────────────────────────────

function makeDefaultProps() {
  return {
    scope: 'institute' as const,
    loginMutation: vi.fn().mockResolvedValue({}),
    selectInstituteMutation: vi.fn().mockResolvedValue({
      accessToken: makeJwt(FUTURE),
      refreshToken: 'rt',
      user: MOCK_USER,
    }),
    refreshMutation: vi.fn().mockResolvedValue({
      accessToken: makeJwt(FUTURE),
      refreshToken: 'rt-new',
      user: MOCK_USER,
    }),
    logoutMutation: vi.fn().mockResolvedValue(undefined),
  };
}

function renderUseAuth(props = makeDefaultProps()) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider {...props}>{children}</AuthProvider>,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useAuth', () => {
  it('throws when called outside an AuthProvider', () => {
    // Suppress React error boundary noise in test output
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
    errorSpy.mockRestore();
  });
});

describe('AuthProvider — initial state (no stored tokens)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('starts loading then settles to unauthenticated when no tokens exist', async () => {
    const { result } = renderUseAuth();

    // May briefly be loading=true — wait for it to settle
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('reports scope from props', async () => {
    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.scope).toBe('institute');
  });
});

describe('AuthProvider — session restore from storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('restores authenticated session when valid tokens are in storage', async () => {
    const accessToken = makeJwt(FUTURE);
    sessionStorage.setItem('roviq-institute-access-token', accessToken);
    localStorage.setItem('roviq-institute-refresh-token', 'stored-refresh');
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(MOCK_USER);
  });

  it('falls back to refresh mutation when access token is expired but refresh token exists', async () => {
    const expiredToken = makeJwt(PAST);
    sessionStorage.setItem('roviq-institute-access-token', expiredToken);
    localStorage.setItem('roviq-institute-refresh-token', 'valid-refresh');
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const props = makeDefaultProps();
    const newAccess = makeJwt(FUTURE);
    props.refreshMutation.mockResolvedValue({
      accessToken: newAccess,
      refreshToken: 'new-refresh',
      user: MOCK_USER,
    });

    const { result } = renderUseAuth(props);

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(props.refreshMutation).toHaveBeenCalledWith('valid-refresh');
  });

  it('clears state and remains unauthenticated when refresh mutation fails', async () => {
    const expiredToken = makeJwt(PAST);
    sessionStorage.setItem('roviq-institute-access-token', expiredToken);
    localStorage.setItem('roviq-institute-refresh-token', 'bad-refresh');

    const props = makeDefaultProps();
    props.refreshMutation.mockRejectedValue(new Error('Invalid token'));

    const { result } = renderUseAuth(props);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets needsInstituteSelection when memberships are stored but no valid tokens', async () => {
    localStorage.setItem('roviq-institute-memberships', JSON.stringify(MOCK_MEMBERSHIPS));

    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.needsInstituteSelection).toBe(true);
    expect(result.current.memberships).toEqual(MOCK_MEMBERSHIPS);
  });
});

describe('AuthProvider — login flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sets authenticated state after successful login', async () => {
    const props = makeDefaultProps();
    const accessToken = makeJwt(FUTURE);
    props.loginMutation.mockResolvedValue({
      accessToken,
      refreshToken: 'rt-login',
      user: MOCK_USER,
    } satisfies LoginResult);

    const { result } = renderUseAuth(props);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ username: 'priya.admin', password: 'pass' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(MOCK_USER);
  });

  it('sets needsInstituteSelection when login requires institute selection', async () => {
    const props = makeDefaultProps();
    props.loginMutation.mockResolvedValue({
      requiresInstituteSelection: true,
      selectionToken: 'sel-token',
      memberships: MOCK_MEMBERSHIPS,
    } satisfies LoginResult);

    const { result } = renderUseAuth(props);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ username: 'multi', password: 'pass' });
    });

    expect(result.current.needsInstituteSelection).toBe(true);
    expect(result.current.memberships).toEqual(MOCK_MEMBERSHIPS);
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('AuthProvider — selectInstitute', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('authenticates and clears institute selection after selecting', async () => {
    const props = makeDefaultProps();
    // Simulate a login that triggered institute selection
    props.loginMutation.mockResolvedValue({
      requiresInstituteSelection: true,
      selectionToken: 'sel-token',
      memberships: MOCK_MEMBERSHIPS,
    });

    const { result } = renderUseAuth(props);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ username: 'multi', password: 'pass' });
    });

    expect(result.current.needsInstituteSelection).toBe(true);

    await act(async () => {
      await result.current.selectInstitute('m1');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.needsInstituteSelection).toBe(false);
    expect(props.selectInstituteMutation).toHaveBeenCalledWith('sel-token', 'm1');
  });

  it('throws when selectInstitute is called without a pending selectionToken', async () => {
    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.selectInstitute('m1');
      }),
    ).rejects.toThrow('Session expired');
  });
});

describe('AuthProvider — logout', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('clears auth state on logout', async () => {
    const accessToken = makeJwt(FUTURE);
    sessionStorage.setItem('roviq-institute-access-token', accessToken);
    localStorage.setItem('roviq-institute-refresh-token', 'rt');
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.memberships).toBeNull();
  });

  it('completes logout even when logoutMutation throws', async () => {
    const accessToken = makeJwt(FUTURE);
    sessionStorage.setItem('roviq-institute-access-token', accessToken);
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const props = makeDefaultProps();
    props.logoutMutation.mockRejectedValue(new Error('Network error'));

    const { result } = renderUseAuth(props);
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    // State is still cleared even if the server call fails
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('AuthProvider — getAccessToken', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns the stored access token', async () => {
    const token = makeJwt(FUTURE);
    sessionStorage.setItem('roviq-institute-access-token', token);
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getAccessToken()).toBe(token);
  });

  it('prefers the impersonation token over the stored access token', async () => {
    const regularToken = makeJwt(FUTURE);
    sessionStorage.setItem('roviq-institute-access-token', regularToken);
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const impersonationToken = makeJwt(FUTURE, { isImpersonated: true });
    sessionStorage.setItem('roviq-impersonation-token', impersonationToken);

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getAccessToken()).toBe(impersonationToken);
  });

  it('returns null when no tokens are stored', async () => {
    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getAccessToken()).toBeNull();
  });
});

describe('AuthProvider — impersonation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('detects isImpersonated from the access token claim', async () => {
    const impToken = makeJwt(FUTURE, { isImpersonated: true });
    sessionStorage.setItem('roviq-institute-access-token', impToken);
    localStorage.setItem('roviq-institute-user', JSON.stringify(MOCK_USER));

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isImpersonated).toBe(true);
  });

  it('clears the impersonation token and sets impersonationEnded flag on notifyImpersonationEnded', async () => {
    const impersonationToken = makeJwt(FUTURE, { isImpersonated: true });
    sessionStorage.setItem('roviq-impersonation-token', impersonationToken);

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.notifyImpersonationEnded();
    });

    expect(sessionStorage.getItem('roviq-impersonation-token')).toBeNull();
    expect(result.current.impersonationEnded).toBe(true);
  });

  it('clears impersonationEnded flag on clearImpersonationEnded', async () => {
    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.notifyImpersonationEnded();
    });
    expect(result.current.impersonationEnded).toBe(true);

    act(() => {
      result.current.clearImpersonationEnded();
    });
    expect(result.current.impersonationEnded).toBe(false);
  });
});

// ── ImpersonationBanner component ─────────────────────────────────────────────

describe('ImpersonationBanner', () => {
  it.todo('renders banner when isImpersonated is true (component not yet found in codebase)');
  it.todo('hides banner when not impersonating');
  it.todo('shows exit impersonation button that calls notifyImpersonationEnded');
  it.todo('shows impersonator name in the banner');
});
