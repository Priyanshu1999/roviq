'use client';

import { NotFoundPage } from '@roviq/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('error');
  const router = useRouter();

  return (
    <NotFoundPage
      description={t('pageNotFound')}
      actionLabel={t('goHome')}
      onAction={() => router.push('/dashboard')}
    />
  );
}
