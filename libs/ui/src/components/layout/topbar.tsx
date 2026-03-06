'use client';

import { Bell, Building2, Check, ChevronsUpDown, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { MobileSidebar } from './sidebar';
import type { LayoutConfig, OrgSwitcherConfig } from './types';

function OrgSwitcher({ config }: { config: OrgSwitcherConfig }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Building2 className="size-4" />
          <span className="max-w-[120px] truncate text-xs">{config.currentOrgName}</span>
          <ChevronsUpDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {config.memberships.map((m) => (
          <DropdownMenuItem key={m.tenantId} onClick={() => config.onSwitch(m.tenantId)}>
            <div className="flex w-full items-center gap-2">
              {m.orgLogoUrl ? (
                <img src={m.orgLogoUrl} alt={m.orgName} className="h-6 w-6 rounded object-cover" />
              ) : (
                <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded text-xs font-bold">
                  {m.orgName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.orgName}</div>
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

function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

function UserMenu({ onLogout }: { onLogout?: () => void }) {
  const t = useTranslations('auth');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            U
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>{t('profile')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>{t('logout')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ config }: { config: LayoutConfig }) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <MobileSidebar config={config} />
      {config.orgSwitcher && <OrgSwitcher config={config.orgSwitcher} />}
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Bell className="size-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu onLogout={config.onLogout} />
      </div>
    </header>
  );
}
