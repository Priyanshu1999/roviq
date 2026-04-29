'use client';

import { Inbox, InboxContent } from '@novu/nextjs';
import { useCounts, useNovu } from '@novu/nextjs/hooks';
import { Button } from '@roviq/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@roviq/ui/components/ui/popover';
import { Bell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import type { NotificationConfig } from './types';

/**
 * Renders the Novu inbox INLINE in the topbar.
 *
 * Why we don't use `<Inbox>` standalone: by default `@novu/nextjs`'s `<Inbox>`
 * component auto-mounts BOTH a bell trigger AND a Floating-UI popover. When
 * the trigger lives in the topbar but layout/scroll causes Floating-UI's
 * placement to fail, the popover fallback anchors to the viewport
 * bottom-left, leaving a stray "N" bubble overlapping the sidebar.
 *
 * Per the Novu docs (`/novuhq/docs` -> "Custom Popover with Novu InboxContent")
 * the supported pattern for full layout control is to use `<Inbox>` purely as
 * a provider (passing children) and render the trigger + popover ourselves.
 * We use the Roviq `<Popover>` (Radix) so the dropdown matches the rest of
 * the UI and is positioned relative to the in-topbar trigger.
 */
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
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? { variables: darkVariables } : undefined,
        variables: lightVariables,
      }}
    >
      <NotificationBellTrigger />
    </Inbox>
  );
}

/**
 * Trigger + popover. Lives inside `<Inbox>` so `useCounts()` / `useNovu()`
 * have access to the Novu context.
 */
function NotificationBellTrigger() {
  const tNav = useTranslations('nav');
  // useCounts subscribes to real-time unread updates from the Novu socket.
  const { counts } = useCounts({ filters: [{ read: false }] });
  const unreadCount = counts?.[0]?.count ?? 0;

  // Reference useNovu so any consumer extension (event listeners) can hang off
  // the same provider without re-instantiating it. Cheap call — no network.
  void useNovu();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tNav('notifications')}
          data-testid="notification-bell"
          className="relative"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              data-testid="notification-bell-badge"
              className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
              aria-live="polite"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">{tNav('notifications')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="h-[600px] w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <InboxContent />
      </PopoverContent>
    </Popover>
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
