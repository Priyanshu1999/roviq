'use client';

import type { AuthScope, LoginInput, LoginResult } from '@roviq/auth';
import { AuthProvider, createAuthMutations, createScopedTokenStorage, useAuth } from '@roviq/auth';
import { GraphQLProvider } from '@roviq/graphql';
import { ThemeProvider } from '@roviq/ui/components/theme-provider';
import { Toaster } from '@roviq/ui/components/ui/sonner';
import { TooltipProvider } from '@roviq/ui/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005';
const GRAPHQL_HTTP = `${API_URL}/api/graphql`;
const GRAPHQL_WS = GRAPHQL_HTTP.replace(/^http/, 'ws');

const authMutations = createAuthMutations(GRAPHQL_HTTP);

/** Returns the correct login mutation based on scope */
function getScopedLoginMutation(scope: AuthScope): (input: LoginInput) => Promise<LoginResult> {
  switch (scope) {
    case 'platform':
      return authMutations.adminLogin;
    case 'reseller':
      return authMutations.resellerLogin;
    case 'institute':
      return authMutations.instituteLogin;
  }
}

async function passkeyLogin(): Promise<LoginResult> {
  const { optionsJSON, challengeId } = await authMutations.generatePasskeyAuthOptions();
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const credential = await startAuthentication({
    optionsJSON,
  });
  return authMutations.verifyPasskeyAuth(challengeId, credential);
}

/** Bridge component that connects GraphQLProvider to AuthProvider's impersonation state */
function GraphQLBridge({
  scopedStorage,
  children,
}: {
  scopedStorage: ReturnType<typeof createScopedTokenStorage>;
  children: React.ReactNode;
}) {
  const { notifyImpersonationEnded, refreshSession } = useAuth();

  const handleImpersonationEnded = React.useCallback(() => {
    notifyImpersonationEnded();
  }, [notifyImpersonationEnded]);

  const handleTokenRefresh = React.useCallback(async () => {
    try {
      await refreshSession();
      return scopedStorage.getAccessToken();
    } catch {
      return null;
    }
  }, [refreshSession, scopedStorage]);

  return (
    <GraphQLProvider
      httpUrl={GRAPHQL_HTTP}
      wsUrl={GRAPHQL_WS}
      apiUrl={API_URL}
      getAccessToken={() => {
        if (typeof window !== 'undefined') {
          const impToken = sessionStorage.getItem('roviq-impersonation-token');
          if (impToken) return impToken;
        }
        return scopedStorage.getAccessToken();
      }}
      onAuthError={() => {
        // Handled by AuthProvider's session expired dialog
      }}
      onTokenRefresh={handleTokenRefresh}
      onImpersonationEnded={handleImpersonationEnded}
    >
      {children}
    </GraphQLProvider>
  );
}

interface ProvidersProps {
  scope?: AuthScope;
  children: React.ReactNode;
}

export function Providers({ scope = 'institute', children }: ProvidersProps) {
  const t = useTranslations('auth');
  const scopedStorage = React.useMemo(() => createScopedTokenStorage(scope), [scope]);

  const sessionExpiredLabels = React.useMemo(
    () => ({
      title: t('sessionExpired'),
      description: t('sessionExpiredDescription'),
      formLabels: {
        password: t('password'),
        enterPassword: t('enterPassword'),
        signIn: t('signIn'),
        signingIn: t('signingIn'),
        signInWithPasskey: t('signInWithPasskey'),
        or: t('or'),
        loginFailed: t('loginFailed'),
        passkeyNotAvailable: t('passkeyNotAvailable'),
        switchAccount: t('switchAccount'),
      },
    }),
    [t],
  );

  const loginMutation = React.useMemo(() => getScopedLoginMutation(scope), [scope]);

  return (
    <AuthProvider
      scope={scope}
      loginMutation={loginMutation}
      passkeyLoginMutation={passkeyLogin}
      selectInstituteMutation={authMutations.selectInstitute}
      switchInstituteMutation={authMutations.switchInstitute}
      refreshMutation={authMutations.refresh}
      changePasswordMutation={authMutations.changePassword}
      logoutMutation={authMutations.logout}
      sessionExpiredLabels={sessionExpiredLabels}
    >
      <GraphQLBridge scopedStorage={scopedStorage}>
        <NuqsAdapter>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </NuqsAdapter>
      </GraphQLBridge>
    </AuthProvider>
  );
}
