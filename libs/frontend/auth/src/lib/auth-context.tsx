'use client';

import type { AuthScope } from '@roviq/common-types';
import * as React from 'react';
import { checkIsImpersonated, isTokenExpired } from './jwt-decode';
import type { SessionExpiredDialogProps } from './session-expired-dialog';
import { SessionExpiredDialog } from './session-expired-dialog';
import { createScopedTokenStorage } from './token-storage';
import type { AuthState, AuthUser, LoginInput, LoginResult, MembershipInfo } from './types';

interface AuthContextValue extends AuthState {
  scope: AuthScope;
  sessionExpired: boolean;
  needsInstituteSelection: boolean;
  memberships: MembershipInfo[] | null;
  isImpersonated: boolean;
  impersonationEnded: boolean;
  login: (input: LoginInput) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => string | null;
  selectInstitute: (membershipId: string) => Promise<void>;
  switchInstitute: (membershipId: string) => Promise<void>;
  notifyImpersonationEnded: () => void;
  clearImpersonationEnded: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  scope?: AuthScope;
  loginMutation: (input: LoginInput) => Promise<LoginResult>;
  passkeyLoginMutation?: () => Promise<LoginResult>;
  selectInstituteMutation: (
    selectionToken: string,
    membershipId: string,
  ) => Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>;
  switchInstituteMutation?: (
    membershipId: string,
    accessToken: string,
    currentRefreshToken: string,
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
  scope = 'institute',
  loginMutation,
  passkeyLoginMutation,
  selectInstituteMutation,
  switchInstituteMutation,
  refreshMutation,
  logoutMutation,
  onAuthError,
  sessionExpiredLabels,
  children,
}: AuthProviderProps) {
  // Use scoped storage so tokens from different scopes don't collide
  const tokenStorage = React.useMemo(() => createScopedTokenStorage(scope), [scope]);

  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [needsInstituteSelection, setNeedsInstituteSelection] = React.useState(false);
  const [pendingSelectionToken, setPendingSelectionToken] = React.useState<string | null>(null);
  const [memberships, setMemberships] = React.useState<MembershipInfo[] | null>(null);
  const [impersonationEnded, setImpersonationEnded] = React.useState(false);

  // Check for impersonation session first (sessionStorage, dies with tab)
  const impersonationToken =
    typeof window !== 'undefined' ? sessionStorage.getItem('roviq-impersonation-token') : null;

  const [state, setState] = React.useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTenantIdRef = React.useRef<string | undefined>(undefined);

  // Derive isImpersonated from impersonation token or current access token
  const isImpersonated = React.useMemo(
    () =>
      checkIsImpersonated(impersonationToken) ||
      checkIsImpersonated(state.tokens?.accessToken ?? null),
    [impersonationToken, state.tokens?.accessToken],
  );

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
          } catch (err) {
            // If password was changed, clear all state and force re-login
            const message = err instanceof Error ? err.message : '';
            if (message.includes('Password changed') || message.includes('PASSWORD_CHANGED')) {
              tokenStorage.clear();
              if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
              setState({
                user: null,
                tokens: null,
                isAuthenticated: false,
                isLoading: false,
              });
              onAuthError?.();
              return;
            }
            setSessionExpired(true);
            onAuthError?.();
          }
        }, expiresIn);
      } catch {
        // Invalid token, ignore
      }
    },
    [refreshMutation, onAuthError, tokenStorage],
  );

  // Restore session on mount
  React.useEffect(() => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    const user = tokenStorage.getUser();

    // If valid tokens exist, restore authenticated state and memberships
    if (accessToken && user && !isTokenExpired(accessToken)) {
      setState({
        user,
        tokens: { accessToken, refreshToken: refreshToken ?? '' },
        isAuthenticated: true,
        isLoading: false,
      });
      setMemberships(tokenStorage.getMemberships());
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
      // No valid tokens — check for pending institute selection (multi-institute login in progress)
      const storedMemberships = tokenStorage.getMemberships();
      if (storedMemberships) {
        setMemberships(storedMemberships);
        setNeedsInstituteSelection(true);
      }
      setState((s) => ({ ...s, isLoading: false }));
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshMutation, scheduleRefresh, tokenStorage]);

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
      } else if (result.requiresInstituteSelection && result.memberships && result.selectionToken) {
        // Multi-institute login — store memberships + selectionToken for institute picker
        tokenStorage.setMemberships(result.memberships);
        setMemberships(result.memberships);
        setPendingSelectionToken(result.selectionToken);
        setNeedsInstituteSelection(true);
      }
    },
    [scheduleRefresh, tokenStorage],
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
  }, [tokenStorage]);

  const selectInstitute = React.useCallback(
    async (membershipId: string) => {
      if (!pendingSelectionToken) {
        clearAllState();
        throw new Error('Session expired');
      }

      const result = await selectInstituteMutation(pendingSelectionToken, membershipId);
      tokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      tokenStorage.setUser(result.user);
      // Keep memberships in storage — needed by the institute switcher
      // after page reload. Only clear the selection state.
      setNeedsInstituteSelection(false);
      setPendingSelectionToken(null);
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
    [selectInstituteMutation, pendingSelectionToken, scheduleRefresh, clearAllState, tokenStorage],
  );

  const switchInstitute = React.useCallback(
    async (membershipId: string) => {
      const accessToken = tokenStorage.getAccessToken();
      const refreshToken = tokenStorage.getRefreshToken();
      if (!accessToken || !refreshToken) throw new Error('No access token');

      if (switchInstituteMutation) {
        const result = await switchInstituteMutation(membershipId, accessToken, refreshToken);
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
      } else {
        throw new Error('switchInstituteMutation is required for institute switching');
      }
    },
    [switchInstituteMutation, scheduleRefresh, tokenStorage],
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
  }, [logoutMutation, tokenStorage]);

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
  }, [refreshMutation, scheduleRefresh, tokenStorage]);

  const getAccessToken = React.useCallback(() => {
    // Prefer impersonation token if present (sessionStorage, dies with tab)
    if (typeof window !== 'undefined') {
      const impToken = sessionStorage.getItem('roviq-impersonation-token');
      if (impToken) return impToken;
    }
    return tokenStorage.getAccessToken();
  }, [tokenStorage]);

  const notifyImpersonationEnded = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('roviq-impersonation-token');
    }
    setImpersonationEnded(true);
  }, []);

  const clearImpersonationEnded = React.useCallback(() => {
    setImpersonationEnded(false);
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
      scope,
      sessionExpired,
      needsInstituteSelection,
      memberships,
      isImpersonated,
      impersonationEnded,
      login,
      loginWithPasskey,
      logout,
      refreshSession,
      getAccessToken,
      selectInstitute,
      switchInstitute,
      notifyImpersonationEnded,
      clearImpersonationEnded,
    }),
    [
      state,
      scope,
      sessionExpired,
      needsInstituteSelection,
      memberships,
      isImpersonated,
      impersonationEnded,
      login,
      loginWithPasskey,
      logout,
      refreshSession,
      getAccessToken,
      selectInstitute,
      switchInstitute,
      notifyImpersonationEnded,
      clearImpersonationEnded,
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
