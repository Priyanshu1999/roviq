'use client';

import { PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
}

const SidebarContext = React.createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

function SidebarNavContent({ config }: { config: LayoutConfig }) {
  const pathname = usePathname();

  return (
    <ScrollArea className="flex-1 py-4">
      <nav className="flex flex-col gap-6 px-3">
        {config.navGroups.map((group) => (
          <div key={group.title}>
            <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h4>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
                      <Badge variant="secondary" className="ml-auto text-xs">
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

export function DesktopSidebar({ config }: { config: LayoutConfig }) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        'hidden border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col md:transition-all md:duration-300',
        collapsed ? 'md:w-0 md:overflow-hidden' : 'md:w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && <span className="text-lg font-semibold">{config.appName}</span>}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
          <PanelLeft className="size-4" />
        </Button>
      </div>
      <SidebarNavContent config={config} />
    </aside>
  );
}

export function MobileSidebar({ config }: { config: LayoutConfig }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <PanelLeft className="size-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">{config.appName}</span>
        </div>
        <SidebarNavContent config={config} />
      </SheetContent>
    </Sheet>
  );
}
