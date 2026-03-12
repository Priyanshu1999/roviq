'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import {
  BarChart2,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { logout, user, memberships, switchOrganization } = useAuth();

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

  const orgSwitcher =
    memberships && memberships.length > 1 && user?.tenantId
      ? {
          currentTenantId: user.tenantId,
          currentOrgName: memberships.find((m) => m.tenantId === user.tenantId)?.orgName ?? '',
          memberships,
          onSwitch: (tenantId: string) => {
            switchOrganization(tenantId).then(() => {
              window.location.reload();
            });
          },
        }
      : undefined;

  const config: LayoutConfig = {
    appName: tCommon('appName'),
    user: user ? { username: user.username, email: user.email } : undefined,
    onLogout: logout,
    orgSwitcher,
    notifications: subscriberHash
      ? {
          applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APP_ID ?? '',
          subscriberId,
          subscriberHash,
          tenantId: user?.tenantId,
        }
      : undefined,
    navGroups: [
      {
        title: t('overview'),
        items: [
          { title: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
          { title: t('institutes'), href: '/institutes', icon: Building2 },
          { title: t('users'), href: '/users', icon: Users },
        ],
      },
      {
        title: t('system'),
        items: [
          { title: t('roles'), href: '/roles', icon: Shield },
          { title: t('auditLogs'), href: '/audit-logs', icon: FileText },
          { title: t('observability'), href: '/observability', icon: BarChart2 },
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
