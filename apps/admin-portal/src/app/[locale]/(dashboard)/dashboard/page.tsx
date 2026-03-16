'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@roviq/ui';
import { Activity, Building2, MonitorCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type HealthStatus = 'ok' | 'error' | 'shutting_down';

function useHealthStatus() {
  const [status, setStatus] = React.useState<HealthStatus | null>(null);

  React.useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => {
        if (!res.headers.get('content-type')?.includes('json')) throw new Error('not json');
        return res.json();
      })
      .then((data: { status: HealthStatus }) => setStatus(data.status))
      .catch(() => setStatus('error'));
  }, []);

  return status;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const health = useHealthStatus();

  const healthLabel =
    health === null
      ? t('checkingHealth')
      : health === 'ok'
        ? t('healthy')
        : health === 'shutting_down'
          ? t('degraded')
          : t('unhealthy');

  const healthDescription =
    health === 'ok'
      ? t('allServicesRunning')
      : health === 'shutting_down'
        ? t('someServicesDegraded')
        : health === 'error'
          ? t('servicesDown')
          : '';

  const healthClassName =
    health === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : health === 'shutting_down'
        ? 'text-yellow-600 dark:text-yellow-400'
        : health === 'error'
          ? 'text-red-600 dark:text-red-400'
          : 'text-muted-foreground';

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
      value: healthLabel,
      description: healthDescription,
      icon: MonitorCheck,
      valueClassName: healthClassName,
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
