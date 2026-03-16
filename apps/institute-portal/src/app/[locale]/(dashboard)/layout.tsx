'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import { useI18nField } from '@roviq/i18n';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import {
  Bell,
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '../../../hooks/use-push-notifications';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { logout, user, memberships, switchInstitute } = useAuth();
  const ti = useI18nField();

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

  const instituteSwitcher =
    memberships && memberships.length > 1 && user?.tenantId
      ? {
          currentTenantId: user.tenantId,
          currentInstituteName:
            ti(memberships.find((m) => m.tenantId === user.tenantId)?.instituteName) ?? '',
          memberships: memberships.map((m) => ({
            tenantId: m.tenantId,
            instituteName: ti(m.instituteName),
            instituteSlug: m.instituteSlug,
            instituteLogoUrl: m.instituteLogoUrl,
            roleName: ti(m.roleName),
          })),
          onSwitch: (tenantId: string) => {
            switchInstitute(tenantId).then(() => window.location.reload());
          },
        }
      : undefined;

  const config: LayoutConfig = {
    appName: tCommon('appName'),
    user: user ? { username: user.username, email: user.email } : undefined,
    onLogout: logout,
    instituteSwitcher,
    notifications: {
      applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER ?? '',
      subscriberId,
      subscriberHash: subscriberHash ?? '',
      tenantId: user?.tenantId,
      backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL || undefined,
      socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL || undefined,
    },
    navGroups: [
      {
        title: t('overview'),
        items: [
          { title: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
          { title: t('users'), href: '/users', icon: Users },
        ],
      },
      {
        title: t('academic'),
        items: [
          { title: t('standards'), href: '/standards', icon: GraduationCap },
          { title: t('subjects'), href: '/subjects', icon: BookOpen },
          { title: t('timetable'), href: '/timetable', icon: Calendar },
        ],
      },
      {
        title: t('system'),
        items: [
          { title: t('settings'), href: '/settings', icon: Settings },
          { title: t('notificationPreferences'), href: '/settings/notifications', icon: Bell },
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
