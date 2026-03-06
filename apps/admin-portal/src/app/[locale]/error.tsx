'use client';

import { ErrorPage } from '@roviq/ui';
import { useTranslations } from 'next-intl';

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error boundary convention requires this name
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  return (
    <ErrorPage
      title={t('somethingWentWrong')}
      description={t('errorDescription')}
      actionLabel={t('tryAgain')}
      reset={reset}
    />
  );
}
