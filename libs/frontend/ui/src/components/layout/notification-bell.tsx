'use client';

import { Inbox } from '@novu/react';
import { useLocale } from 'next-intl';
import type { NotificationConfig } from './types';

export function NotificationBell({ config }: { config: NotificationConfig }) {
  const locale = useLocale();

  return (
    <Inbox
      applicationIdentifier={config.applicationIdentifier}
      subscriber={config.subscriberId}
      subscriberHash={config.subscriberHash}
      localization={{ locale }}
      context={config.tenantId ? { tenant: { id: config.tenantId } } : undefined}
    />
  );
}
