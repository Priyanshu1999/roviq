'use client';

import { Building2, PanelLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../ui/sheet';
import type { LayoutConfig } from './types';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function SidebarNavContent({ config }: { config: LayoutConfig }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { setMobileOpen } = useSidebar();

  const handleSearch = () => {
    setMobileOpen(false);
    if (config.onSearch) {
      config.onSearch();
      return;
    }
    // Fallback: dispatch the canonical Cmd+K so any listener (CommandPalette) opens.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
    }
  };

  return (
    <ScrollArea className="flex-1 py-4">
      <nav className="flex flex-col gap-6 px-3" aria-label="Sidebar">
        {config.searchEnabled && (
          <button
            type="button"
            onClick={handleSearch}
            data-testid="sidebar-search"
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="ms-auto text-[10px] text-muted-foreground/70">⌘K</kbd>
          </button>
        )}
        {config.navGroups.map((group) => (
          <div key={group.title}>
            <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h4>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const localizedHref = `/${locale}${item.href}`;
                const isActive =
                  pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={localizedHref}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      item.disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    {Icon && <Icon className="size-4 shrink-0" />}
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ms-auto text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

function DrawerHeader({ config }: { config: LayoutConfig }) {
  const switcher = config.instituteSwitcher;
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <span className="text-lg font-semibold">{config.appName}</span>
      {switcher && (
        <div className="ms-auto flex max-w-[55%] items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{switcher.currentInstituteName}</span>
        </div>
      )}
    </div>
  );
}

export function DesktopSidebar({ config }: { config: LayoutConfig }) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      data-testid="desktop-sidebar"
      className={cn(
        'hidden border-r bg-sidebar text-sidebar-foreground xl:flex xl:flex-col xl:transition-all xl:duration-300',
        collapsed ? 'xl:w-0 xl:overflow-hidden' : 'xl:w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && <span className="text-lg font-semibold">{config.appName}</span>}
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
        >
          <PanelLeft className="size-4" />
        </Button>
      </div>
      <SidebarNavContent config={config} />
    </aside>
  );
}

export function MobileSidebar({ config }: { config: LayoutConfig }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          data-testid="mobile-sidebar-trigger"
        >
          <PanelLeft className="size-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" data-testid="mobile-sidebar-sheet">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <DrawerHeader config={config} />
        <SidebarNavContent config={config} />
      </SheetContent>
    </Sheet>
  );
}
