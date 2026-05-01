'use client';

import { Bell, Building2, Check, ChevronsUpDown, Monitor, Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Breadcrumbs } from './breadcrumbs';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';
import { MobileSidebar } from './sidebar';
import type { InstituteSwitcherConfig, LayoutConfig } from './types';

function InstituteSwitcherInline({ config }: { config: InstituteSwitcherConfig }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden xl:inline-flex gap-1.5 max-w-[220px]"
          data-testid="institute-switcher"
        >
          <Building2 className="size-4 shrink-0" />
          <span className="truncate text-xs">{config.currentInstituteName}</span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" data-testid="institute-switcher-menu">
        {config.memberships.map((m) => (
          <DropdownMenuItem key={m.tenantId} onClick={() => config.onSwitch(m.tenantId)}>
            <div className="flex w-full items-center gap-2">
              {m.instituteLogoUrl ? (
                <Image
                  src={m.instituteLogoUrl}
                  alt={m.instituteName}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded text-xs font-bold">
                  {m.instituteName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.instituteName}</div>
                <div className="text-muted-foreground truncate text-xs">{m.roleName}</div>
              </div>
              {m.tenantId === config.currentTenantId && <Check className="size-4 shrink-0" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 3-state theme toggle: System → Light → Dark. Standalone button (used in
 * topbar at xl+) and a sub-menu variant (used inside UserMenu on mobile).
 */
function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const ActiveIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme" data-testid="theme-toggle">
          <ActiveIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => setTheme('system')} data-testid="theme-system">
          <Monitor className="me-2 size-4" />
          System
          {theme === 'system' && <Check className="ms-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('light')} data-testid="theme-light">
          <Sun className="me-2 size-4" />
          Light
          {theme === 'light' && <Check className="ms-auto size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} data-testid="theme-dark">
          <Moon className="me-2 size-4" />
          Dark
          {theme === 'dark' && <Check className="ms-auto size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ onLogout, username }: { onLogout?: () => void; username?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const initial = username ? username.charAt(0).toUpperCase() : 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          data-testid="user-menu-trigger"
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {initial}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/account`} data-testid="user-menu-profile">
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} data-testid="user-menu-logout">
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ config }: { config: LayoutConfig }) {
  const tNav = useTranslations('nav');
  return (
    <header
      data-testid="topbar"
      className="flex h-14 min-w-0 items-center gap-3 overflow-hidden border-b bg-background px-4"
    >
      <MobileSidebar config={config} />
      {config.instituteSwitcher && <InstituteSwitcherInline config={config.instituteSwitcher} />}
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1">
        {config.notifications ? (
          <NotificationBell config={config.notifications} />
        ) : (
          <Button variant="ghost" size="icon" aria-label={tNav('notifications')}>
            <Bell className="size-4" />
            <span className="sr-only">{tNav('notifications')}</span>
          </Button>
        )}
        <ThemeToggle />
        <div className="hidden xl:block">
          <LocaleSwitcher />
        </div>
        <UserMenu onLogout={config.onLogout} username={config.user?.username} />
      </div>
    </header>
  );
}
