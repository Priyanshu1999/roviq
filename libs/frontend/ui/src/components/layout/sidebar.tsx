'use client';

import { Building2, PanelLeft, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '../ui/sheet';
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
  const pathname = usePathname();

  // Auto-close the mobile drawer on route change so navigations from the
  // CommandPalette (or any other in-page link) don't leave the drawer open
  // over the new page. Only fires when the path actually changes.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * Pick the nav item whose href is the longest prefix of `pathname`.
 * Prevents a parent route (e.g. `/settings`) from highlighting when the user
 * is actually on a child route (e.g. `/settings/consent`) that has its own
 * sibling nav item.
 */
export function pickActiveHref(
  allHrefs: string[],
  pathname: string,
  locale: string,
): string | null {
  const matches = allHrefs.filter((href) => {
    const localized = `/${locale}${href}`;
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === localized ||
      pathname.startsWith(`${localized}/`)
    );
  });
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function SidebarNavContent({ config }: { config: LayoutConfig }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { setMobileOpen } = useSidebar();

  const allItemHrefs = React.useMemo(
    () => config.navGroups.flatMap((g) => g.items.map((i) => i.href)),
    [config.navGroups],
  );
  const activeHref = pickActiveHref(allItemHrefs, pathname, locale);

  const handleSearch = () => {
    // Open the CommandPalette over the drawer — don't close the drawer first
    // (closing then opening another overlay feels jarring; the palette layers
    // on top via Radix Dialog's z-index ordering).
    if (config.onSearch) {
      config.onSearch();
      return;
    }
    // Fallback: dispatch a synthetic Cmd+K / Ctrl+K on `document` so the
    // CommandPalette's `document.addEventListener('keydown', …)` fires.
    // Set both modifiers so it works on macOS, Linux, and Windows where the
    // listener checks `metaKey || ctrlKey`.
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
      );
    }
  };

  return (
    <ScrollArea className="min-h-0 flex-1 px-3 py-4">
      <nav className="flex flex-col gap-7" aria-label="Sidebar">
        {config.searchEnabled && (
          <button
            type="button"
            onClick={handleSearch}
            data-testid="sidebar-search"
            className={cn(
              'group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium',
              'border border-border/60 bg-muted/40 text-muted-foreground transition-colors',
              'hover:border-border hover:bg-muted hover:text-foreground',
            )}
          >
            <Search
              className="size-4 shrink-0 opacity-70 group-hover:opacity-100"
              aria-hidden="true"
            />
            <span className="flex-1 text-left">Search</span>
            <kbd className="ms-auto inline-flex h-5 items-center rounded-md border border-border/70 bg-background px-1.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
        {config.navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <h4 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              {group.title}
            </h4>
            {group.items.map((item) => {
              const localizedHref = `/${locale}${item.href}`;
              const isActive = activeHref === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={localizedHref}
                  onClick={() => setMobileOpen(false)}
                  data-active={isActive ? 'true' : 'false'}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    item.disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  {/* Active accent — soft left bar that grows on hover */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary transition-all',
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
                    )}
                  />
                  {Icon && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className="ms-auto h-5 px-1.5 text-[10px] font-medium"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

/**
 * Drawer footer — placed at the bottom of the mobile drawer so the close
 * affordance lands in the natural thumb-zone of the phone (matching the
 * one-handed reach pattern from iOS/Android sheet UIs).
 *
 * Contains:
 * - Institute logo tile + name + appName meta (read-only summary).
 * - Large X close button on the trailing edge wired to the Sheet's close.
 *
 * Uses safe-area-inset-bottom padding so it clears the iOS home indicator.
 */
function DrawerFooter({ config }: { config: LayoutConfig }) {
  const switcher = config.instituteSwitcher;
  return (
    <div
      data-testid="drawer-footer"
      className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center gap-3">
        {switcher ? (
          <>
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-sm font-semibold leading-tight"
                data-testid="drawer-footer-institute"
              >
                {switcher.currentInstituteName}
              </div>
              <div className="text-muted-foreground truncate text-xs">{config.appName}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-base font-semibold">{config.appName}</div>
        )}
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            data-testid="drawer-close"
            className="ms-auto h-11 w-11 shrink-0 rounded-xl"
          >
            <X className="size-5" />
          </Button>
        </SheetClose>
      </div>
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
  // Drawer is fully controlled by SidebarProvider's `mobileOpen` — opened
  // via the bottom-tab "More" button. No topbar trigger button below xl
  // since it'd duplicate the More button on mobile/tablet.
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="left"
        className="data-[side=left]:w-full p-0 sm:max-w-sm"
        data-testid="mobile-sidebar-sheet"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNavContent config={config} />
        <DrawerFooter config={config} />
      </SheetContent>
    </Sheet>
  );
}
