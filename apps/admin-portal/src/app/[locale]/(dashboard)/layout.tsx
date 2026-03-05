'use client';

import type { LayoutConfig } from '@roviq/ui';
import { AdminLayout } from '@roviq/ui';
import { Activity, Building2, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const config: LayoutConfig = {
    appName: tCommon('appName'),
    navGroups: [
      {
        title: 'Overview',
        items: [
          { title: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
          { title: t('institutes'), href: '/institutes', icon: Building2 },
          { title: t('users'), href: '/users', icon: Users },
        ],
      },
      {
        title: 'System',
        items: [
          { title: t('roles'), href: '/roles', icon: Shield },
          { title: t('health'), href: '/health', icon: Activity },
          { title: t('settings'), href: '/settings', icon: Settings },
        ],
      },
    ],
  };

  return <AdminLayout config={config}>{children}</AdminLayout>;
}
