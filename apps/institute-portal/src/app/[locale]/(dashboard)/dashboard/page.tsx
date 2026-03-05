'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@roviq/ui';
import { GraduationCap, UserCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  const stats = [
    {
      title: t('totalStudents'),
      value: '0',
      description: t('noStudentsEnrolled'),
      icon: Users,
    },
    {
      title: t('totalTeachers'),
      value: '0',
      description: t('noTeachersAssigned'),
      icon: UserCheck,
    },
    {
      title: t('totalStandards'),
      value: '0',
      description: t('noStandardsConfigured'),
      icon: GraduationCap,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
