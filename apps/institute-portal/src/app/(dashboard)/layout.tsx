'use client';

import type { LayoutConfig } from '@roviq/ui';
import { AdminLayout } from '@roviq/ui';
import { BookOpen, Calendar, GraduationCap, LayoutDashboard, Settings, Users } from 'lucide-react';

const config: LayoutConfig = {
  appName: 'Roviq Institute',
  navGroups: [
    {
      title: 'Overview',
      items: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Users', href: '/users', icon: Users },
      ],
    },
    {
      title: 'Academic',
      items: [
        { title: 'Standards', href: '/standards', icon: GraduationCap },
        { title: 'Subjects', href: '/subjects', icon: BookOpen },
        { title: 'Timetable', href: '/timetable', icon: Calendar },
      ],
    },
    {
      title: 'System',
      items: [{ title: 'Settings', href: '/settings', icon: Settings }],
    },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout config={config}>{children}</AdminLayout>;
}
