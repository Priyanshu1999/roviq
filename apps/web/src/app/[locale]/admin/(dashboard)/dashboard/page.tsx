'use client';

import { Link } from '@roviq/i18n';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { testIds } from '@web/testing/testid-registry';
import { Building2, FileText, Settings, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');

  const quickLinks = [
    {
      id: 'institutes',
      title: t('manageInstitutes'),
      description: t('manageInstitutesDescription'),
      href: '/institutes',
      icon: Building2,
    },
    {
      id: 'users',
      title: t('manageUsers'),
      description: t('manageUsersDescription'),
      href: '/users',
      icon: Users,
    },
    {
      id: 'audit-logs',
      title: t('viewAuditLogs'),
      description: t('viewAuditLogsDescription'),
      href: '/audit-logs',
      icon: FileText,
    },
    {
      id: 'settings',
      title: t('viewSettings'),
      description: t('viewSettingsDescription'),
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6" data-testid={testIds.adminDashboard.page}>
      <Card data-testid={testIds.adminDashboard.welcomeCard}>
        <CardHeader>
          <CardTitle className="text-2xl" data-testid={testIds.adminDashboard.welcomeTitle}>
            {t('platformWelcome')}
          </CardTitle>
          <CardDescription data-testid={testIds.adminDashboard.welcomeDescription}>
            {t('platformWelcomeDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
      <div>
        <CardTitle className="mb-4 text-lg" data-testid={testIds.adminDashboard.quickLinksTitle}>
          {t('quickLinks')}
        </CardTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Card key={link.href} data-testid={testIds.adminDashboard.quickLink(link.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link
                        href={link.href}
                        data-testid={testIds.adminDashboard.quickLinkAnchor(link.id)}
                      >
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
