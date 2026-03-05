'use client';

import * as React from 'react';
import { isTokenExpired } from './jwt-decode';
import { tokenStorage } from './token-storage';
import type { AuthState, AuthUser, LoginInput } from './types';

interface AuthContextValue extends AuthState {
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => string | null;
  switchTenant: (tenantId: string) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  loginMutation: (input: LoginInput) => Promise<{
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
  children: React.ReactNode;
}

export function AuthProvider({
  loginMutation,
  refreshMutation,
  logoutMutation,
  onAuthError,
  children,
}: AuthProviderProps) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = React.useCallback(
    (accessToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      // Refresh 60 seconds before expiry
      const parts = accessToken.split('.');
      if (parts.length !== 3) return;

      try {
        const payload = JSON.parse(atob(parts[1]!));
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
            tokenStorage.clear();
            setState({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
            });
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

    if (accessToken && user && !isTokenExpired(accessToken)) {
      setState({
        user,
        tokens: { accessToken, refreshToken: refreshToken ?? '' },
        isAuthenticated: true,
        isLoading: false,
      });
      scheduleRefresh(accessToken);
    } else if (refreshToken) {
      // Try to refresh
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

  const login = React.useCallback(
    async (input: LoginInput) => {
      const result = await loginMutation(input);
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
    [loginMutation, scheduleRefresh],
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

  const switchTenant = React.useCallback((tenantId: string) => {
    const user = tokenStorage.getUser();
    if (user) {
      const updated = { ...user, tenantId };
      tokenStorage.setUser(updated);
      setState((s) => ({ ...s, user: updated }));
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshSession,
      getAccessToken,
      switchTenant,
    }),
    [state, login, logout, refreshSession, getAccessToken, switchTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
