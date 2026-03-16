'use client';

import { Inbox } from '@novu/nextjs';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import type { NotificationConfig } from './types';

export function NotificationBell({ config }: { config: NotificationConfig }) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();

  return (
    <Inbox
      applicationIdentifier={config.applicationIdentifier}
      subscriber={config.subscriberId}
      subscriberHash={config.subscriberHash || undefined}
      backendUrl={config.backendUrl || undefined}
      socketUrl={config.socketUrl || undefined}
      localization={{ locale }}
      // Tenant context intentionally omitted — the Inbox should show all
      // notifications for the subscriber regardless of tenant. System-level
      // events (login, password-reset) have no tenant, so filtering by tenant
      // would hide them.
      placement="bottom-end"
      placementOffset={8}
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? { variables: darkVariables } : undefined,
        variables: lightVariables,
        elements: {
          bellIcon: {
            width: '16px',
            height: '16px',
          },
        },
      }}
    />
  );
}

const lightVariables = {
  colorBackground: 'var(--background)',
  colorForeground: 'var(--foreground)',
  colorPrimary: 'var(--primary)',
  colorPrimaryForeground: 'var(--primary-foreground)',
  colorSecondary: 'var(--secondary)',
  colorSecondaryForeground: 'var(--secondary-foreground)',
  colorNeutral: 'var(--border)',
  colorRing: 'var(--ring)',
  colorShadow: 'oklch(0 0 0 / 0.08)',
  fontSize: '14px',
  borderRadius: 'var(--radius)',
};

const darkVariables = {
  colorBackground: 'var(--background)',
  colorForeground: 'var(--foreground)',
  colorPrimary: 'var(--primary)',
  colorPrimaryForeground: 'var(--primary-foreground)',
  colorSecondary: 'var(--secondary)',
  colorSecondaryForeground: 'var(--secondary-foreground)',
  colorNeutral: 'var(--border)',
  colorRing: 'var(--ring)',
  colorShadow: 'oklch(0 0 0 / 0.3)',
};
