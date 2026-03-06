'use client';

import { AuthProvider, createAuthMutations, tokenStorage } from '@roviq/auth';
import { GraphQLProvider } from '@roviq/graphql';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const GRAPHQL_HTTP = `${API_URL}/api/graphql`;
const GRAPHQL_WS = GRAPHQL_HTTP.replace(/^http/, 'ws');

const authMutations = createAuthMutations(GRAPHQL_HTTP);

export function Providers({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');

  const sessionExpiredLabels = React.useMemo(
    () => ({
      title: t('sessionExpired'),
      description: t('sessionExpiredDescription'),
      formLabels: {
        username: t('username'),
        password: t('password'),
        enterUsername: t('enterUsername'),
        enterPassword: t('enterPassword'),
        signIn: t('signIn'),
        signingIn: t('signingIn'),
      },
    }),
    [t],
  );

  return (
    <AuthProvider
      loginMutation={authMutations.login}
      selectOrgMutation={authMutations.selectOrganization}
      refreshMutation={authMutations.refresh}
      logoutMutation={authMutations.logout}
      sessionExpiredLabels={sessionExpiredLabels}
    >
      <GraphQLProvider
        httpUrl={GRAPHQL_HTTP}
        wsUrl={GRAPHQL_WS}
        getAccessToken={() => tokenStorage.getAccessToken()}
        onAuthError={() => {
          // Handled by AuthProvider's session expired dialog
        }}
      >
        {children}
      </GraphQLProvider>
    </AuthProvider>
  );
}
