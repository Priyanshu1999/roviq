'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@roviq/ui';
import { Activity, Building2, MonitorCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  const stats = [
    {
      title: t('totalInstitutes'),
      value: '0',
      description: t('noInstitutesYet'),
      icon: Building2,
    },
    {
      title: t('totalUsers'),
      value: '0',
      description: t('noUsersYet'),
      icon: Users,
    },
    {
      title: t('activeSessions'),
      value: '0',
      description: t('noActiveSessions'),
      icon: Activity,
    },
    {
      title: t('systemHealth'),
      value: t('healthy'),
      description: t('allServicesRunning'),
      icon: MonitorCheck,
      valueClassName: 'text-green-600 dark:text-green-400',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.valueClassName ?? ''}`}>{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
