'use client';

import { useTranslations } from 'next-intl';

const GRAFANA_DASHBOARD_URL = process.env['NEXT_PUBLIC_GRAFANA_URL'] ?? 'http://localhost:3001';

export default function ObservabilityPage() {
  const t = useTranslations('observability');

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="min-h-0 flex-1">
        <iframe
          src={`${GRAFANA_DASHBOARD_URL}/d/roviq-overview?orgId=1&kiosk=tv`}
          className="h-full w-full rounded-lg border"
          title={t('title')}
        />
      </div>
    </div>
  );
}
