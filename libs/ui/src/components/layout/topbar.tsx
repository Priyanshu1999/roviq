'use client';

import { Bell, Moon, Sun } from 'lucide-react';
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
import type { LayoutConfig } from './types';

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

function UserMenu() {
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
        <DropdownMenuItem>{t('logout')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ config }: { config: LayoutConfig }) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <MobileSidebar config={config} />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Bell className="size-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
