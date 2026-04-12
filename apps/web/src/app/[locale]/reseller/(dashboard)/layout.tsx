'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import { gql, useQuery } from '@roviq/graphql';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import {
  Building2,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '../../../../hooks/use-push-notifications';

const UNVERIFIED_COUNT_QUERY = gql`
  query UnverifiedPaymentsCount {
    unverifiedPayments(first: 0) {
      id
    }
  }
`;

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

  const eeEnabled = process.env.NEXT_PUBLIC_ROVIQ_EE === 'true';

  const { data: unverifiedData } = useQuery<{
    unverifiedPayments: { id: string }[];
  }>(UNVERIFIED_COUNT_QUERY, { skip: !eeEnabled });
  const unverifiedCount = unverifiedData?.unverifiedPayments?.length ?? 0;

  const config: LayoutConfig = {
    appName: tCommon('appNameReseller'),
    user: user ? { username: user.username, email: user.email } : undefined,
    onLogout: logout,
    notifications:
      subscriberHash && process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER
        ? {
            applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
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
          { title: t('instituteGroups'), href: '/institute-groups', icon: FolderTree },
          { title: t('team'), href: '/team', icon: Users },
        ],
      },
      ...(eeEnabled
        ? [
            {
              title: t('billing'),
              items: [
                { title: t('billingDashboard'), href: '/billing/dashboard', icon: LayoutDashboard },
                { title: t('plans'), href: '/billing/plans', icon: CreditCard },
                { title: t('subscriptions'), href: '/billing/subscriptions', icon: CreditCard },
                { title: t('invoices'), href: '/billing/invoices', icon: FileText },
                { title: t('gatewayConfigs'), href: '/billing/gateway-configs', icon: Settings },
                {
                  title: t('upiVerification'),
                  href: '/billing/upi-verification',
                  icon: ShieldCheck,
                  badge: unverifiedCount > 0 ? String(unverifiedCount) : undefined,
                },
              ],
            },
          ]
        : []),
      {
        title: t('system'),
        items: [
          { title: t('auditLogs'), href: '/audit', icon: ScrollText },
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
