'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import { NAV_SLUGS } from '@roviq/common-types';
import type { LayoutConfig, NavRegistryEntry } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import {
  BarChart2,
  Building2,
  ClipboardCheck,
  FileText,
  FolderTree,
  LayoutDashboard,
  Settings,
  Shield,
  Store,
  UserCog,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '../../../../hooks/use-push-notifications';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { logout, user } = useAuth();

  usePushNotifications();

  const subscriberId = user?.id ?? '';
  const [subscriberHash, setSubscriberHash] = useState<string>();

  useEffect(() => {
    if (!subscriberId || !process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER) return;
    fetch('/api/novu-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriberId }),
    })
      .then((r) => r.json())
      .then((data) => setSubscriberHash(data.subscriberHash));
  }, [subscriberId]);

  // Admin registry covers the platform-admin destinations. The audit-log page
  // lives at `/audit-logs` (note the trailing 's'), unlike institute/reseller.
  const NAV_REGISTRY: Record<string, NavRegistryEntry> = {
    [NAV_SLUGS.dashboard]: {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: t('dashboard'),
    },
    [NAV_SLUGS.institutes]: {
      href: '/institutes',
      icon: Building2,
      label: t('institutes'),
      ability: { action: 'read', subject: 'Institute' },
    },
    [NAV_SLUGS.resellers]: {
      href: '/resellers',
      icon: Store,
      label: t('resellers'),
      ability: { action: 'read', subject: 'Reseller' },
    },
    [NAV_SLUGS.audit]: {
      href: '/audit-logs',
      icon: FileText,
      label: t('auditLogs'),
      ability: { action: 'read', subject: 'AuditLog' },
    },
    [NAV_SLUGS.settings]: {
      href: '/settings',
      icon: Settings,
      label: t('settings'),
    },
    [NAV_SLUGS.account]: {
      href: '/account',
      icon: UserCog,
      label: t('account'),
    },
  };

  const ADMIN_DEFAULT_SLUGS: string[] = [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.resellers,
    NAV_SLUGS.institutes,
    NAV_SLUGS.audit,
  ];

  const config: LayoutConfig = {
    appName: tCommon('appNameAdmin'),
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
          { title: t('resellers'), href: '/resellers', icon: Store },
          { title: t('instituteGroups'), href: '/institute-groups', icon: FolderTree },
          { title: t('users'), href: '/users', icon: Users },
        ],
      },
      {
        title: t('system'),
        items: [
          { title: t('roles'), href: '/roles', icon: Shield },
          { title: t('auditLogs'), href: '/audit-logs', icon: FileText },
          { title: t('attendance'), href: '/attendance', icon: ClipboardCheck },
          { title: t('observability'), href: '/observability', icon: BarChart2 },
          { title: t('settings'), href: '/settings', icon: Settings },
          { title: t('account'), href: '/account', icon: UserCog },
        ],
      },
    ],
    navRegistry: NAV_REGISTRY,
    bottomNav: {
      slugs: user?.primaryNavSlugs ?? [],
      defaultSlugs: ADMIN_DEFAULT_SLUGS,
      moreLabel: t('more'),
    },
    searchEnabled: true,
  };

  return (
    <ProtectedRoute>
      <AbilityProvider rules={user?.abilityRules ?? []}>
        <AdminLayout config={config}>{children}</AdminLayout>
      </AbilityProvider>
    </ProtectedRoute>
  );
}
