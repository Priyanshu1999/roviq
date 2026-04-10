'use client';

import { Link } from '@roviq/i18n';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { Building2, FileText, Settings, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');

  const quickLinks = [
    {
      title: t('manageInstitutes'),
      description: t('manageInstitutesDescription'),
      href: '/institutes',
      icon: Building2,
      testId: 'admin-dashboard-link-institutes',
    },
    {
      title: t('manageUsers'),
      description: t('manageUsersDescription'),
      href: '/users',
      icon: Users,
      testId: 'admin-dashboard-link-users',
    },
    {
      title: t('viewAuditLogs'),
      description: t('viewAuditLogsDescription'),
      href: '/audit-logs',
      icon: FileText,
      testId: 'admin-dashboard-link-audit-logs',
    },
    {
      title: t('viewSettings'),
      description: t('viewSettingsDescription'),
      href: '/settings',
      icon: Settings,
      testId: 'admin-dashboard-link-settings',
    },
  ];

  return (
    <div className="space-y-6" data-test-id="admin-dashboard-page">
      <Card data-test-id="admin-dashboard-welcome-card">
        <CardHeader>
          <CardTitle className="text-2xl" data-test-id="admin-dashboard-welcome-title">
            {t('platformWelcome')}
          </CardTitle>
          <CardDescription data-test-id="admin-dashboard-welcome-description">
            {t('platformWelcomeDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
      <div>
        <CardTitle className="mb-4 text-lg" data-test-id="admin-dashboard-quick-links-title">
          {t('quickLinks')}
        </CardTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Card key={link.href} data-test-id={link.testId}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link href={link.href} data-test-id={`${link.testId}-link`}>
                        {link.title}
                      </Link>
                    </Button>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{link.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
