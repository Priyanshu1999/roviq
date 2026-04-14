'use client';

import type { PasskeyManagerLabels } from '@roviq/auth';
import { createAuthMutations, PasskeyManager } from '@roviq/auth';
import { useFormatDate } from '@roviq/i18n';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005';
const GRAPHQL_HTTP = `${API_URL}/api/graphql`;

const authMutations = createAuthMutations(GRAPHQL_HTTP);

const passkeyMutations = {
  myPasskeys: authMutations.myPasskeys,
  generateRegistrationOptions: authMutations.generatePasskeyRegistrationOptions,
  verifyRegistration: authMutations.verifyPasskeyRegistration,
  removePasskey: authMutations.removePasskey,
};

export default function AccountPage() {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const { format } = useFormatDate();
  const formatDate = React.useCallback((d: string) => format(new Date(d), 'PP'), [format]);

  const passkeyLabels = React.useMemo<PasskeyManagerLabels>(
    () => ({
      title: tAuth('passkeys'),
      description: tAuth('passkeysDescription'),
      addPasskey: tAuth('addPasskey'),
      removePasskey: tAuth('removePasskey'),
      noPasskeys: tAuth('noPasskeys'),
      passkeyName: tAuth('passkeyName'),
      enterPasskeyName: tAuth('enterPasskeyName'),
      passkeyNameHint: tAuth('passkeyNameHint'),
      confirmPassword: tAuth('confirmPassword'),
      registeredAt: tAuth('registeredAt'),
      lastUsedAt: tAuth('lastUsedAt'),
      never: tAuth('never'),
      backedUp: tAuth('backedUp'),
      cancel: tAuth('cancel'),
      removePasskeyConfirm: tAuth('removePasskeyConfirm'),
      nameTooLong: tAuth('nameTooLong'),
      passkeyPasswordRequired: tAuth('passkeyPasswordRequired'),
    }),
    [tAuth],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="max-w-2xl">
        <PasskeyManager
          mutations={passkeyMutations}
          labels={passkeyLabels}
          formatDate={formatDate}
        />
      </div>
    </div>
  );
}
