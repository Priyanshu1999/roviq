'use client';

import type { LayoutConfig } from '@roviq/ui';
import { AdminLayout } from '@roviq/ui';
import { BookOpen, Calendar, GraduationCap, LayoutDashboard, Settings, Users } from 'lucide-react';
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
          { title: t('users'), href: '/users', icon: Users },
        ],
      },
      {
        title: 'Academic',
        items: [
          { title: t('standards'), href: '/standards', icon: GraduationCap },
          { title: t('subjects'), href: '/subjects', icon: BookOpen },
          { title: t('timetable'), href: '/timetable', icon: Calendar },
        ],
      },
      {
        title: 'System',
        items: [{ title: t('settings'), href: '/settings', icon: Settings }],
      },
    ],
  };

  return <AdminLayout config={config}>{children}</AdminLayout>;
}
