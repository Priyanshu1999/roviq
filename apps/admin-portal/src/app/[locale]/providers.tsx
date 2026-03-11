'use client';

import type { LoginResult } from '@roviq/auth';
import { AuthProvider, createAuthMutations, tokenStorage } from '@roviq/auth';
import { GraphQLProvider } from '@roviq/graphql';
import {
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from '@simplewebauthn/browser';
import { useTranslations } from 'next-intl';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const GRAPHQL_HTTP = `${API_URL}/api/graphql`;
const GRAPHQL_WS = GRAPHQL_HTTP.replace(/^http/, 'ws');

const authMutations = createAuthMutations(GRAPHQL_HTTP);

async function passkeyLogin(): Promise<LoginResult> {
  const { optionsJSON, challengeId } = await authMutations.generatePasskeyAuthOptions();
  const credential = await startAuthentication({
    optionsJSON: optionsJSON as unknown as PublicKeyCredentialRequestOptionsJSON,
  });
  return authMutations.verifyPasskeyAuth(
    challengeId,
    credential as unknown as Record<string, unknown>,
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');

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
      },
    }),
    [t],
  );

  return (
    <AuthProvider
      loginMutation={authMutations.login}
      passkeyLoginMutation={passkeyLogin}
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
        <NuqsAdapter>{children}</NuqsAdapter>
      </GraphQLProvider>
    </AuthProvider>
  );
}
