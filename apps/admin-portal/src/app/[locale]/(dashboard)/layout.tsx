'use client';

import { ProtectedRoute, useAuth } from '@roviq/auth';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout } from '@roviq/ui';
import { Activity, Building2, LayoutDashboard, Settings, Shield, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { logout, user, memberships, switchOrganization } = useAuth();

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
          { title: t('health'), href: '/health', icon: Activity },
          { title: t('settings'), href: '/settings', icon: Settings },
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
