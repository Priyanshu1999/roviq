'use client';

import type { LayoutConfig } from '@roviq/ui';
import { AdminLayout } from '@roviq/ui';
import { Activity, Building2, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';

const config: LayoutConfig = {
  appName: 'Roviq Admin',
  navGroups: [
    {
      title: 'Overview',
      items: [
        { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { title: 'Institutes', href: '/institutes', icon: Building2 },
        { title: 'Users', href: '/users', icon: Users },
      ],
    },
    {
      title: 'System',
      items: [
        { title: 'Roles & Permissions', href: '/roles', icon: Shield },
        { title: 'System Health', href: '/health', icon: Activity },
        { title: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout config={config}>{children}</AdminLayout>;
}
