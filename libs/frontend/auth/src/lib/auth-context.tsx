'use client';

import * as React from 'react';
import { isTokenExpired } from './jwt-decode';
import type { SessionExpiredDialogProps } from './session-expired-dialog';
import { SessionExpiredDialog } from './session-expired-dialog';
import { tokenStorage } from './token-storage';
import type { AuthState, AuthUser, LoginInput, LoginResult, MembershipInfo } from './types';

interface AuthContextValue extends AuthState {
  sessionExpired: boolean;
  needsInstituteSelection: boolean;
  memberships: MembershipInfo[] | null;
  login: (input: LoginInput) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => string | null;
  selectInstitute: (tenantId: string) => Promise<void>;
  switchInstitute: (tenantId: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  loginMutation: (input: LoginInput) => Promise<LoginResult>;
  passkeyLoginMutation?: () => Promise<LoginResult>;
  selectInstituteMutation: (
    tenantId: string,
    platformToken: string,
  ) => Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>;
  refreshMutation: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>;
  logoutMutation: () => Promise<void>;
  onAuthError?: () => void;
  sessionExpiredLabels?: SessionExpiredDialogProps['labels'];
  children: React.ReactNode;
}

export function AuthProvider({
  loginMutation,
  passkeyLoginMutation,
  selectInstituteMutation,
  refreshMutation,
  logoutMutation,
  onAuthError,
  sessionExpiredLabels,
  children,
}: AuthProviderProps) {
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [needsInstituteSelection, setNeedsInstituteSelection] = React.useState(false);
  const [memberships, setMemberships] = React.useState<MembershipInfo[] | null>(null);
  const [state, setState] = React.useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTenantIdRef = React.useRef<string | undefined>(undefined);

  // Capture tenantId when session expires so re-login can auto-select the same institute
  React.useEffect(() => {
    if (sessionExpired) {
      prevTenantIdRef.current = state.user?.tenantId;
    } else {
      prevTenantIdRef.current = undefined;
    }
  }, [sessionExpired, state.user?.tenantId]);

  const scheduleRefresh = React.useCallback(
    (accessToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const parts = accessToken.split('.');
      if (parts.length !== 3) return;

      try {
        const payload = JSON.parse(atob(parts[1] as string));
        const expiresIn = payload.exp * 1000 - Date.now() - 60_000;
        if (expiresIn <= 0) return;

        refreshTimerRef.current = setTimeout(async () => {
          try {
            const refreshToken = tokenStorage.getRefreshToken();
            if (!refreshToken) return;
            const result = await refreshMutation(refreshToken);
            tokenStorage.setTokens({
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            });
            tokenStorage.setUser(result.user);
            setState({
              user: result.user,
              tokens: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
              },
              isAuthenticated: true,
              isLoading: false,
            });
            scheduleRefresh(result.accessToken);
          } catch {
            setSessionExpired(true);
            onAuthError?.();
          }
        }, expiresIn);
      } catch {
        // Invalid token, ignore
      }
    },
    [refreshMutation, onAuthError],
  );

  // Restore session on mount
  React.useEffect(() => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    const user = tokenStorage.getUser();

    // Check for pending institute selection
    const platformToken = tokenStorage.getPlatformToken();
    const storedMemberships = tokenStorage.getMemberships();
    if (platformToken && storedMemberships) {
      setMemberships(storedMemberships);
      setNeedsInstituteSelection(true);
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    if (accessToken && user && !isTokenExpired(accessToken)) {
      const storedMems = tokenStorage.getMemberships();
      if (storedMems) setMemberships(storedMems);
      setState({
        user,
        tokens: { accessToken, refreshToken: refreshToken ?? '' },
        isAuthenticated: true,
        isLoading: false,
      });
      scheduleRefresh(accessToken);
    } else if (refreshToken) {
      refreshMutation(refreshToken)
        .then((result) => {
          tokenStorage.setTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
          tokenStorage.setUser(result.user);
          setState({
            user: result.user,
            tokens: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            },
            isAuthenticated: true,
            isLoading: false,
          });
          scheduleRefresh(result.accessToken);
        })
        .catch(() => {
          tokenStorage.clear();
          setState({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
          });
        });
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshMutation, scheduleRefresh]);

  const handleLoginResult = React.useCallback(
    async (result: LoginResult) => {
      if (result.accessToken && result.refreshToken && result.user) {
        tokenStorage.setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        tokenStorage.setUser(result.user);
        setState({
          user: result.user,
          tokens: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          },
          isAuthenticated: true,
          isLoading: false,
        });
        scheduleRefresh(result.accessToken);
      } else if (result.platformToken && result.memberships) {
        // Session expired re-login: auto-select the same institute the user was in
        const prevTenantId = prevTenantIdRef.current;
        if (prevTenantId) {
          try {
            const orgResult = await selectInstituteMutation(prevTenantId, result.platformToken);
            tokenStorage.setTokens({
              accessToken: orgResult.accessToken,
              refreshToken: orgResult.refreshToken,
            });
            tokenStorage.setUser(orgResult.user);
            setState({
              user: orgResult.user,
              tokens: {
                accessToken: orgResult.accessToken,
                refreshToken: orgResult.refreshToken,
              },
              isAuthenticated: true,
              isLoading: false,
            });
            scheduleRefresh(orgResult.accessToken);
          } catch {
            // Auto-select failed (e.g. membership revoked) — fall back to institute selection
            tokenStorage.setPlatformToken(result.platformToken);
            tokenStorage.setMemberships(result.memberships);
            setMemberships(result.memberships);
            setNeedsInstituteSelection(true);
            setSessionExpired(false);
          }
        } else {
          tokenStorage.setPlatformToken(result.platformToken);
          tokenStorage.setMemberships(result.memberships);
          setMemberships(result.memberships);
          setNeedsInstituteSelection(true);
        }
      }
    },
    [scheduleRefresh, selectInstituteMutation],
  );

  const login = React.useCallback(
    async (input: LoginInput) => {
      const result = await loginMutation(input);
      await handleLoginResult(result);
    },
    [loginMutation, handleLoginResult],
  );

  const loginWithPasskey = React.useCallback(async () => {
    if (!passkeyLoginMutation) {
      throw new Error('Passkey login is not configured');
    }
    const result = await passkeyLoginMutation();
    await handleLoginResult(result);
  }, [passkeyLoginMutation, handleLoginResult]);

  const clearAllState = React.useCallback(() => {
    tokenStorage.clear();
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    setNeedsInstituteSelection(false);
    setMemberships(null);
    setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const selectInstitute = React.useCallback(
    async (tenantId: string) => {
      const platformToken = tokenStorage.getPlatformToken();
      if (!platformToken || isTokenExpired(platformToken)) {
        clearAllState();
        throw new Error('Session expired');
      }

      const result = await selectInstituteMutation(tenantId, platformToken);
      tokenStorage.clearPlatform();
      tokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      tokenStorage.setUser(result.user);
      setNeedsInstituteSelection(false);
      setState({
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        isAuthenticated: true,
        isLoading: false,
      });
      scheduleRefresh(result.accessToken);
    },
    [selectInstituteMutation, scheduleRefresh, clearAllState],
  );

  const switchInstitute = React.useCallback(
    async (tenantId: string) => {
      // Re-login flow: use current access token to call selectInstitute mutation
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) throw new Error('No access token');

      const result = await selectInstituteMutation(tenantId, accessToken);
      tokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      tokenStorage.setUser(result.user);
      setState({
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        isAuthenticated: true,
        isLoading: false,
      });
      scheduleRefresh(result.accessToken);
    },
    [selectInstituteMutation, scheduleRefresh],
  );

  const logout = React.useCallback(async () => {
    try {
      await logoutMutation();
    } catch {
      // Ignore errors during logout
    }
    tokenStorage.clear();
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    setNeedsInstituteSelection(false);
    setMemberships(null);
    setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, [logoutMutation]);

  const refreshSession = React.useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    const result = await refreshMutation(refreshToken);
    tokenStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    tokenStorage.setUser(result.user);
    setState({
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      isAuthenticated: true,
      isLoading: false,
    });
    scheduleRefresh(result.accessToken);
  }, [refreshMutation, scheduleRefresh]);

  const getAccessToken = React.useCallback(() => {
    return tokenStorage.getAccessToken();
  }, []);

  const handleReLoginSuccess = React.useCallback(() => {
    setSessionExpired(false);
  }, []);

  const handleSwitchAccount = React.useCallback(async () => {
    setSessionExpired(false);
    await logout();
  }, [logout]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      sessionExpired,
      needsInstituteSelection,
      memberships,
      login,
      loginWithPasskey,
      logout,
      refreshSession,
      getAccessToken,
      selectInstitute,
      switchInstitute,
    }),
    [
      state,
      sessionExpired,
      needsInstituteSelection,
      memberships,
      login,
      loginWithPasskey,
      logout,
      refreshSession,
      getAccessToken,
      selectInstitute,
      switchInstitute,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredDialog
        open={sessionExpired}
        username={state.user?.username}
        onLoginSuccess={handleReLoginSuccess}
        onSwitchAccount={handleSwitchAccount}
        labels={sessionExpiredLabels}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
