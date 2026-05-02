'use client';

import { useTranslations } from 'next-intl';

import { ObservabilityDashboard } from './observability-dashboard';

export default function ObservabilityPage() {
  const t = useTranslations('observability');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <ObservabilityDashboard />
    </div>
  );
}
