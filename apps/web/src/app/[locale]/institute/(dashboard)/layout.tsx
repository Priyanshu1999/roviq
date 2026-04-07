'use client';

import { decodeJwt, ProtectedRoute, useAuth } from '@roviq/auth';
import { useI18nField } from '@roviq/i18n';
import type { LayoutConfig } from '@roviq/ui';
import { AbilityProvider, AdminLayout, Button, Card, CardContent } from '@roviq/ui';
import {
  Bell,
  Calendar,
  CalendarRange,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  Settings,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { usePushNotifications } from '../../../../hooks/use-push-notifications';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const { logout, user, memberships, switchInstitute } = useAuth();
  const ti = useI18nField();

  usePushNotifications();

  // --- Impersonation detection ---
  const getImpersonationState = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const token = sessionStorage.getItem('roviq-impersonation-token');
    if (!token) return false;
    const payload = decodeJwt(token);
    return payload?.isImpersonated === true;
  }, []);

  const isImpersonated = getImpersonationState();
  const impersonatedUserName =
    typeof window !== 'undefined' ? sessionStorage.getItem('roviq-impersonation-user-name') : null;
  const [sessionEnded, setSessionEnded] = useState(false);

  // Periodically check token expiry during impersonation
  useEffect(() => {
    if (!isImpersonated) return;

    const interval = setInterval(() => {
      const token = sessionStorage.getItem('roviq-impersonation-token');
      if (!token) {
        setSessionEnded(true);
        return;
      }
      const payload = decodeJwt(token);
      if (!payload) {
        setSessionEnded(true);
        return;
      }
      const exp = payload.exp * 1000;
      if (Date.now() > exp) {
        setSessionEnded(true);
        sessionStorage.removeItem('roviq-impersonation-token');
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [isImpersonated]);

  // Auto-close tab after session ends
  useEffect(() => {
    if (!sessionEnded) return;
    const timer = setTimeout(() => window.close(), 3000);
    return () => clearTimeout(timer);
  }, [sessionEnded]);

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

  const eeEnabled = process.env.NEXT_PUBLIC_ROVIQ_EE === 'true';

  const config: LayoutConfig = {
    appName: tCommon('appNameInstitute'),
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
          { title: t('academicYears'), href: '/academic-years', icon: CalendarRange },
          { title: t('standards'), href: '/academics', icon: GraduationCap },
          { title: t('timetable'), href: '/timetable', icon: Calendar },
        ],
      },
      ...(eeEnabled
        ? [
            {
              title: t('billing'),
              items: [
                { title: t('subscriptions'), href: '/billing', icon: CreditCard },
                { title: t('invoices'), href: '/billing/invoices', icon: Receipt },
                { title: t('payments'), href: '/billing/payments', icon: Wallet },
              ],
            },
          ]
        : []),
      {
        title: t('system'),
        items: [
          { title: t('auditLogs'), href: '/audit', icon: FileText },
          { title: t('settings'), href: '/settings', icon: Settings },
          {
            title: t('notificationPreferences'),
            href: '/settings/notifications',
            icon: Bell,
          },
          { title: t('account'), href: '/account', icon: UserCog },
        ],
      },
    ],
  };

  return (
    <ProtectedRoute>
      <AbilityProvider rules={user?.abilityRules ?? []}>
        {isImpersonated && (
          <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-black py-2 px-4 flex justify-between items-center">
            <span className="font-medium">
              {tAuth('impersonationBanner', {
                name: impersonatedUserName ?? tAuth('or'),
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-black text-black hover:bg-amber-600"
              onClick={() => window.close()}
            >
              {tAuth('exitImpersonation')}
            </Button>
          </div>
        )}

        {sessionEnded && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-sm">
              <CardContent className="pt-6 text-center space-y-4">
                <p className="font-medium">{tAuth('impersonationSessionEnded')}</p>
                <p className="text-sm text-muted-foreground">{tAuth('impersonationTabClosing')}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <AdminLayout config={config}>{children}</AdminLayout>
      </AbilityProvider>
    </ProtectedRoute>
  );
}
