'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import { Building2, LayoutDashboard, Settings, UserCog, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '../../../../hooks/use-push-notifications';

export default function ResellerDashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { logout, user } = useAuth();

  usePushNotifications();

  const subscriberId = user?.id ?? '';
  const [subscriberHash, setSubscriberHash] = useState<string>();

  useEffect(() => {
    if (!subscriberId) return;
    fetch('/api/novu-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId }),
    })
      .then((r) => r.json())
      .then((data) => setSubscriberHash(data.subscriberHash));
  }, [subscriberId]);

  const config: LayoutConfig = {
    appName: tCommon('appNameReseller'),
    user: user ? { username: user.username, email: user.email } : undefined,
    onLogout: logout,
    notifications: subscriberHash
      ? {
          applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER ?? '',
          subscriberId,
          subscriberHash,
          tenantId: user?.tenantId,
          backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL || undefined,
          socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL || undefined,
        }
      : undefined,
    navGroups: [
      {
        title: t('overview'),
        items: [
          { title: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
          { title: t('institutes'), href: '/institutes', icon: Building2 },
          { title: t('team'), href: '/team', icon: Users },
        ],
      },
      {
        title: t('system'),
        items: [
          { title: t('settings'), href: '/settings', icon: Settings },
          { title: t('account'), href: '/account', icon: UserCog },
        ],
      },
    ],
  };

  return (
    <ProtectedRoute>
      <AbilityProvider rules={user?.abilityRules ?? []}>
        <AdminLayout config={config}>{children}</AdminLayout>
      </AbilityProvider>
    </ProtectedRoute>
  );
}
