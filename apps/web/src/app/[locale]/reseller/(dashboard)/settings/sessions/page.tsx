'use client';

import { createAuthMutations, useSessions } from '@roviq/auth';
import { useFormatDate } from '@roviq/i18n';
import type { SessionData, SessionsPageLabels } from '@roviq/ui';
import { SessionsPage } from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const authMutations = createAuthMutations(`${API_URL}/api/graphql`);

export default function ResellerSessionsPage() {
  const t = useTranslations('sessions');
  const { format } = useFormatDate();

  const { sessions, isLoading, revokeSession, revokeAllOtherSessions } = useSessions({
    fetchSessions: authMutations.mySessions,
    revokeSessionMutation: authMutations.revokeSession,
    revokeAllOtherSessionsMutation: authMutations.revokeAllOtherSessions,
  });

  const labels = React.useMemo<SessionsPageLabels>(
    () => ({
      title: t('title'),
      description: t('description'),
      revokeAll: t('revokeAll'),
      revoking: t('revoking'),
      revoke: t('revoke'),
      loading: t('loading'),
      noSessions: t('noSessions'),
      unknownDevice: t('unknownDevice'),
      unknownIp: t('unknownIp'),
      current: t('current'),
      created: t('created'),
    }),
    [t],
  );

  const formatDate = React.useCallback(
    (dateString: string) => format(new Date(dateString), 'PP'),
    [format],
  );

  const mapped: SessionData[] = sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    isCurrent: s.isCurrent,
  }));

  return (
    <SessionsPage
      sessions={mapped}
      loading={isLoading}
      onRevoke={revokeSession}
      onRevokeAllOther={revokeAllOtherSessions}
      labels={labels}
      formatDate={formatDate}
    />
  );
}
