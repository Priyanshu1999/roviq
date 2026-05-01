'use client';

import {
  Building2,
  ChevronDown,
  Clock,
  PanelLeftClose,
  PanelLeftDashed,
  PanelLeftOpen,
  Pin,
  PinOff,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '../ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { usePins, useRecents } from './sidebar-pins';
import type { LayoutConfig, NavItem } from './types';
import { HighlightedText, useNavFilter } from './use-nav-filter';

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

const COLLAPSED_KEY = 'roviq:sidebar-collapsed';
const GROUP_COLLAPSED_KEY = 'roviq:nav-group-collapsed';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredGroupCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GROUP_COLLAPSED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === true) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Hook for nav-group collapsed state. State persists in localStorage as a
 * sparse map (only collapsed=true entries stored). Cross-tab sync via storage
 * event so toggling in one tab updates others.
 */
function useGroupCollapsed(): {
  collapsed: Record<string, boolean>;
  setCollapsed: (title: string, value: boolean) => void;
} {
  const [collapsed, setCollapsedState] =
    React.useState<Record<string, boolean>>(readStoredGroupCollapsed);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== GROUP_COLLAPSED_KEY) return;
      setCollapsedState(readStoredGroupCollapsed());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCollapsed = React.useCallback((title: string, value: boolean) => {
    setCollapsedState((prev) => {
      const next = { ...prev };
      if (value) {
        next[title] = true;
      } else {
        // Sparse map: only collapsed=true entries are persisted.
        delete next[title];
      }
      if (typeof window !== 'undefined') {
        try {
          if (Object.keys(next).length === 0) {
            window.localStorage.removeItem(GROUP_COLLAPSED_KEY);
          } else {
            window.localStorage.setItem(GROUP_COLLAPSED_KEY, JSON.stringify(next));
          }
        } catch {}
      }
      return next;
    });
  }, []);

  return { collapsed, setCollapsed };
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Initializer fires once per client render; on SSR it returns false (no
  // localStorage), so the first hydrate may flip but no second render fires.
  const [collapsed, setCollapsedState] = React.useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  const setCollapsed = React.useCallback((next: boolean) => {
    setCollapsedState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {}
    }
  }, []);

  // Auto-close the mobile drawer on route change so navigations from the
  // CommandPalette (or any other in-page link) don't leave the drawer open
  // over the new page. Only fires when the path actually changes.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Cmd/Ctrl+B toggles the desktop sidebar collapse state. Bail when focus is
  // inside an editable element so users can still type the letter "b".
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== 'b' && e.key !== 'B') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute?.('contenteditable') === 'true'
        ) {
          return;
        }
      }
      e.preventDefault();
      setCollapsed(!collapsed);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapsed, setCollapsed]);

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

function useNavState(config: LayoutConfig) {
  const pathname = usePathname();
  const locale = useLocale();
  const { setMobileOpen } = useSidebar();
  const allItemHrefs = React.useMemo(
    () => config.navGroups.flatMap((g) => g.items.map((i) => i.href)),
    [config.navGroups],
  );
  const activeHref = pickActiveHref(allItemHrefs, pathname, locale);
  const handleSearch = React.useCallback(() => {
    if (config.onSearch) return config.onSearch();
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
      );
    }
  }, [config.onSearch]);
  return { locale, activeHref, setMobileOpen, handleSearch };
}

function RailItem({
  href,
  title,
  badge,
  Icon,
  isActive,
  disabled,
  onClick,
}: {
  href: string;
  title: string;
  badge?: string;
  Icon?: LayoutConfig['navGroups'][number]['items'][number]['icon'];
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onClick}
          data-active={isActive ? 'true' : 'false'}
          aria-label={title}
          className={cn(
            'group mx-auto flex size-8 items-center justify-center rounded-lg transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          {Icon && <Icon className="size-4" aria-hidden="true" />}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        {title}
        {badge ? ` (${badge})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function CompactRailContent({ config }: { config: LayoutConfig }) {
  const { locale, activeHref, setMobileOpen, handleSearch } = useNavState(config);
  return (
    // Fixed-width inner column (40px) anchored to the start edge so rail
    // icons stay put when the parent's width transitions in/out of collapse.
    <ScrollArea className="min-h-0 w-10 flex-1 shrink-0 px-1 py-4 xl:py-2">
      <TooltipProvider delayDuration={200}>
        <nav className="flex flex-col gap-1.5" aria-label="Sidebar">
          {config.searchEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSearch}
                  data-testid="sidebar-search"
                  aria-label="Search"
                  className="mx-auto flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                >
                  <Search className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search ⌘K</TooltipContent>
            </Tooltip>
          )}
          {config.navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <RailItem
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  title={item.title}
                  badge={item.badge}
                  Icon={item.icon}
                  isActive={activeHref === item.href}
                  disabled={item.disabled}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>
      </TooltipProvider>
    </ScrollArea>
  );
}

/**
 * Hover-revealed pin/unpin toggle that sits inline on a regular nav row.
 * stopPropagation + preventDefault keep clicks from following the parent <Link>.
 */
function PinToggleButton({
  href,
  title,
  pinned,
  onToggle,
  pinLabel,
  unpinLabel,
}: {
  href: string;
  title: string;
  pinned: boolean;
  onToggle: () => void;
  pinLabel: string;
  unpinLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={pinned ? `${unpinLabel} ${title}` : `${pinLabel} ${title}`}
      data-testid={`nav-pin-toggle-${href}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        // delay-0 on the base state → instant fade-out on hover-leave;
        // group-hover:delay-1000 → 1s wait before fade-in on hover-enter.
        'flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-opacity duration-150 delay-0 hover:bg-muted hover:text-foreground focus:opacity-100',
        pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:delay-1000',
      )}
    >
      {pinned ? (
        <PinOff className="size-3.5" aria-hidden="true" />
      ) : (
        <Pin className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Shortcut row used inside the Pinned + Recents sections. Mirrors the regular
 * row visual treatment but skips the inline pin toggle and substring highlight
 * (those rows aren't part of the active filter result set).
 */
function ShortcutRow({
  item,
  locale,
  isActive,
  onClick,
  onUnpin,
  unpinLabel,
}: {
  item: NavItem;
  locale: string;
  isActive: boolean;
  onClick: () => void;
  onUnpin?: () => void;
  unpinLabel?: string;
}) {
  const Icon = item.icon;
  const localizedHref = `/${locale}${item.href}`;
  return (
    <Link
      href={localizedHref}
      onClick={onClick}
      data-active={isActive ? 'true' : 'false'}
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors xl:py-1 xl:text-sm',
        isActive
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        item.disabled && 'pointer-events-none opacity-50',
      )}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      )}
      <span className="flex-1 truncate">{item.title}</span>
      {item.badge && (
        <Badge variant="secondary" className="ms-auto h-4 px-1 text-[10px] font-medium">
          {item.badge}
        </Badge>
      )}
      {onUnpin && (
        <button
          type="button"
          aria-label={`${unpinLabel ?? 'Unpin'} ${item.title}`}
          data-testid={`nav-pin-toggle-${item.href}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUnpin();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-opacity duration-150 delay-0 group-hover:opacity-100 group-hover:delay-1000 hover:bg-muted hover:text-foreground focus:opacity-100"
        >
          <PinOff className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </Link>
  );
}

/**
 * Pinned + Recents shortcut section. Renders a small heading + icon-tinted
 * heading row, then a list of `ShortcutRow`s. Hidden by the caller when items
 * is empty.
 */
function ShortcutSection({
  testId,
  heading,
  Icon,
  items,
  locale,
  activeHref,
  onItemClick,
  onUnpin,
  unpinLabel,
}: {
  testId: string;
  heading: string;
  Icon: typeof Pin;
  items: NavItem[];
  locale: string;
  activeHref: string | null;
  onItemClick: () => void;
  onUnpin?: (href: string) => void;
  unpinLabel?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <Icon className="size-3 opacity-70" aria-hidden="true" />
        <h4 className="flex-1 text-left">{heading}</h4>
      </div>
      <div className="flex flex-col">
        {items.map((item) => (
          <ShortcutRow
            key={item.href}
            item={item}
            locale={locale}
            isActive={activeHref === item.href}
            onClick={onItemClick}
            onUnpin={onUnpin ? () => onUnpin(item.href) : undefined}
            unpinLabel={unpinLabel}
          />
        ))}
      </div>
    </div>
  );
}

function FullNavContent({ config }: { config: LayoutConfig }) {
  const { locale, activeHref, setMobileOpen, handleSearch } = useNavState(config);
  const { collapsed: groupCollapsed, setCollapsed: setGroupCollapsed } = useGroupCollapsed();
  // Tracks groups the user explicitly collapsed while they were active. Lets
  // the active-group auto-expand be overridden without erasing the persisted
  // preference. Cleared when the user navigates away from the group.
  const [activeGroupCollapsedOverride, setActiveGroupCollapsedOverride] = React.useState<
    string | null
  >(null);
  const router = useRouter();
  const tNav = useTranslations('nav');
  const { pins, pin, unpin, isPinned } = usePins();

  // ── B1: pinned + recents shortcuts ───────────────────────────────────────
  // Flatten once; both sections resolve href→item against this list.
  const allItems = React.useMemo(
    () => config.navGroups.flatMap((g) => g.items),
    [config.navGroups],
  );
  const itemByHref = React.useMemo(() => {
    const m = new Map<string, NavItem>();
    for (const it of allItems) m.set(it.href, it);
    return m;
  }, [allItems]);
  const pinnedItems = React.useMemo(
    () => pins.map((href) => itemByHref.get(href)).filter((it): it is NavItem => it !== undefined),
    [pins, itemByHref],
  );
  const recentItems = useRecents(allItems);
  const pinLabel = tNav('pinItem');
  const unpinLabel = tNav('unpinItem');
  // Dedupe: when an item is pinned, hide it from its original group so the
  // sidebar doesn't show the same row twice.
  const pinnedHrefSet = React.useMemo(() => new Set(pins), [pins]);

  // ── B4: search-as-you-type filter ────────────────────────────────────────
  // Local query drives a derived filtered groups view via useNavFilter. Empty
  // query renders full nav. The CommandPalette (Cmd+K) is a separate concern
  // and stays available — clicking the kbd hint dispatches its open event.
  const [query, setQuery] = React.useState('');
  const filteredGroups = useNavFilter(config.navGroups, query);

  // Total filtered items — used for the "single match → Enter navigates" rule.
  const filteredItemCount = React.useMemo(
    () => filteredGroups.reduce((n, g) => n + g.items.length, 0),
    [filteredGroups],
  );

  const onFilterKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        return;
      }
      if (e.key === 'Enter') {
        if (filteredItemCount === 1) {
          const only = filteredGroups[0]?.items[0];
          if (only) {
            e.preventDefault();
            router.push(`/${locale}${only.href}`);
            setMobileOpen(false);
          }
        }
      }
    },
    [filteredItemCount, filteredGroups, router, locale, setMobileOpen],
  );

  // When filtering, force-expand every group with matches so users see hits.
  const isFiltering = query.trim().length > 0;

  const activeGroupTitle = React.useMemo(() => {
    if (!activeHref) return null;
    for (const g of config.navGroups) {
      if (g.items.some((i) => i.href === activeHref)) return g.title;
    }
    return null;
  }, [activeHref, config.navGroups]);

  // Whenever the active group changes, drop any stale override so the next
  // visit to the same group gets a fresh auto-expand.
  React.useEffect(() => {
    setActiveGroupCollapsedOverride((prev) => (prev === activeGroupTitle ? prev : null));
  }, [activeGroupTitle]);

  const isVisuallyCollapsed = React.useCallback(
    (title: string) => {
      if (groupCollapsed[title] !== true) return false;
      // Persisted collapsed; auto-expand only if it's the active group and the
      // user hasn't explicitly collapsed it during this visit.
      if (title === activeGroupTitle && activeGroupCollapsedOverride !== title) return false;
      return true;
    },
    [groupCollapsed, activeGroupTitle, activeGroupCollapsedOverride],
  );

  const toggleGroup = React.useCallback(
    (title: string) => {
      const collapsedNow = isVisuallyCollapsed(title);
      if (collapsedNow) {
        // User wants to expand: clear override + clear persisted preference.
        setActiveGroupCollapsedOverride((prev) => (prev === title ? null : prev));
        setGroupCollapsed(title, false);
      } else {
        // User wants to collapse: persist; if it's the active group, also set
        // the override so the active-group auto-expand doesn't undo it.
        if (title === activeGroupTitle) setActiveGroupCollapsedOverride(title);
        setGroupCollapsed(title, true);
      }
    },
    [isVisuallyCollapsed, setGroupCollapsed, activeGroupTitle],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {config.searchEnabled && (
        <div className="relative shrink-0 px-3 pt-3 pb-2 xl:py-2">
          <Search
            className="pointer-events-none absolute start-5.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFilterKeyDown}
            data-testid="sidebar-filter-input"
            aria-label={tNav('filterPlaceholder')}
            placeholder={tNav('filterPlaceholder')}
            className={cn(
              'flex h-8 w-full items-center rounded-lg border border-border/60 bg-muted/40 ps-8 pe-10 text-sm xl:h-7 xl:text-sm',
              'text-foreground placeholder:text-muted-foreground transition-colors',
              'hover:border-border hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
          <button
            type="button"
            onClick={handleSearch}
            data-testid="sidebar-search"
            aria-label="Open command palette"
            className="absolute end-4.5 top-1/2 -translate-y-1/2"
          >
            <kbd className="inline-flex h-4 items-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] font-medium tabular-nums text-muted-foreground hover:text-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3 xl:pb-2">
        <nav className="flex flex-col gap-5 xl:gap-2" aria-label="Sidebar">
          {!isFiltering && pinnedItems.length > 0 && (
            <ShortcutSection
              testId="nav-pinned-section"
              heading={tNav('pinned')}
              Icon={Pin}
              items={pinnedItems}
              locale={locale}
              activeHref={activeHref}
              onItemClick={() => setMobileOpen(false)}
              onUnpin={unpin}
              unpinLabel={unpinLabel}
            />
          )}
          {!isFiltering && recentItems.length > 0 && (
            <ShortcutSection
              testId="nav-recents-section"
              heading={tNav('recents')}
              Icon={Clock}
              items={recentItems}
              locale={locale}
              activeHref={activeHref}
              onItemClick={() => setMobileOpen(false)}
            />
          )}
          {filteredGroups.map((group) => {
            // While filtering, force-expand every group with matches so users see hits.
            const isCollapsed = !isFiltering && isVisuallyCollapsed(group.title);
            // Hide pinned items from their group when not filtering (Pinned section
            // already shows them — avoids visual duplication).
            const groupItems = isFiltering
              ? group.items
              : group.items.filter((it) => !pinnedHrefSet.has(it.href));
            if (groupItems.length === 0) return null;
            return (
              <div key={group.title} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  data-testid={`nav-group-toggle-${group.title}`}
                  data-collapsed={isCollapsed ? 'true' : 'false'}
                  aria-expanded={!isCollapsed}
                  className={cn(
                    'group/heading flex w-full items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55 cursor-pointer transition-colors hover:text-foreground',
                  )}
                >
                  <h4 className="flex-1 text-left">{group.title}</h4>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'size-3 shrink-0 opacity-0 transition-all duration-150 ease-out group-hover/heading:opacity-60',
                      isCollapsed && '-rotate-90 opacity-60',
                    )}
                  />
                </button>
                {/* CSS grid-rows trick for animatable height. Inner wrapper uses
                  min-h-0 + overflow-hidden so the grid track collapses cleanly. */}
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-150 ease-out',
                    isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col">
                      {groupItems.map((item) => {
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
                              'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors xl:py-1 xl:text-sm',
                              isActive
                                ? 'bg-primary/10 text-foreground'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                              item.disabled && 'pointer-events-none opacity-50',
                            )}
                          >
                            {Icon && (
                              <Icon
                                aria-hidden="true"
                                className={cn(
                                  'size-4 shrink-0 transition-colors',
                                  isActive ? 'text-primary' : 'text-muted-foreground',
                                )}
                              />
                            )}
                            <span className="flex-1 truncate">
                              <HighlightedText text={item.title} match={query} />
                            </span>
                            {item.badge && (
                              <Badge
                                variant="secondary"
                                className="ms-auto h-4 px-1 text-[10px] font-medium"
                              >
                                {item.badge}
                              </Badge>
                            )}
                            <PinToggleButton
                              href={item.href}
                              title={item.title}
                              pinned={isPinned(item.href)}
                              onToggle={() =>
                                isPinned(item.href) ? unpin(item.href) : pin(item.href)
                              }
                              pinLabel={pinLabel}
                              unpinLabel={unpinLabel}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

/** Mobile drawer footer pinned to the bottom (thumb-zone close button + safe-area padding). */
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

  // ── B5: hover-to-expand-temporarily (peek) ───────────────────────────────
  // While `collapsed` is true, hovering the rail for ≥250ms expands the
  // sidebar without touching localStorage. Pointer leave cancels the timer
  // and restores the rail immediately. Disabled on coarse-pointer (touch)
  // devices — they tap to expand instead.
  const [peeked, setPeeked] = React.useState(false);
  const peekTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinePointer = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches;
  }, []);

  const onPointerEnter = React.useCallback(() => {
    if (!collapsed) return;
    if (!isFinePointer()) return;
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setPeeked(true);
    }, 250);
  }, [collapsed, isFinePointer]);

  const onPointerLeave = React.useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setPeeked(false);
  }, []);

  // Drop peek state if the user manually expands (collapsed → false).
  React.useEffect(() => {
    if (!collapsed) setPeeked(false);
  }, [collapsed]);

  React.useEffect(
    () => () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    },
    [],
  );

  const expanded = !collapsed || peeked;

  return (
    <aside
      data-testid="desktop-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-peeked={peeked ? 'true' : 'false'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        'hidden overflow-hidden border-r bg-sidebar text-sidebar-foreground xl:flex xl:flex-col xl:transition-[width] xl:duration-200 xl:ease-out',
        // Rail at 2.5rem (40px) when collapsed — tight icon column.
        // overflow-hidden + fixed-width inner content keeps the rail icons
        // pinned to the start edge during the width transition (no drift).
        expanded ? 'xl:w-65' : 'xl:w-10',
      )}
    >
      <div className="flex h-14 items-center border-b">
        {/* Toggle in a fixed 40px column anchored to the start so it stays
            centered when collapsed and doesn't drift during the width
            transition. AppName fills the remaining space when expanded. */}
        <div className="flex w-10 shrink-0 items-center justify-center">
          {(() => {
            // Three-state toggle icon:
            //   • peek (collapsed but temporarily open): dashed → "click to pin open"
            //   • collapsed permanent: open icon → "click to expand"
            //   • expanded permanent: close icon → "click to collapse"
            const isPeeking = collapsed && peeked;
            const ToggleIcon = isPeeking
              ? PanelLeftDashed
              : collapsed
                ? PanelLeftOpen
                : PanelLeftClose;
            const label = isPeeking
              ? 'Pin sidebar open'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar';
            return (
              <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                title={label}
                data-testid="desktop-sidebar-toggle"
                data-state={isPeeking ? 'peek' : collapsed ? 'collapsed' : 'expanded'}
                onClick={() => setCollapsed(!collapsed)}
              >
                <ToggleIcon className="size-4" />
              </Button>
            );
          })()}
        </div>
        {expanded && (
          <span className="truncate text-base font-semibold pe-3">{config.appName}</span>
        )}
      </div>
      {expanded ? <FullNavContent config={config} /> : <CompactRailContent config={config} />}
    </aside>
  );
}

export function MobileSidebar({ config }: { config: LayoutConfig }) {
  const { mobileOpen, setMobileOpen } = useSidebar();

  // ── B6: swipe-to-close ──────────────────────────────────────────────────
  // Radix Sheet does not expose a built-in swipe-to-dismiss prop in the
  // version we use, so we attach lightweight touch handlers on SheetContent.
  // A predominantly-horizontal left-swipe of >60px closes the drawer; we
  // require |dx| > |dy| so vertical scrolling inside the body is unaffected.
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) <= Math.abs(dy)) return; // mostly vertical, ignore
      if (dx < -60) setMobileOpen(false);
    },
    [setMobileOpen],
  );

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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <FullNavContent config={config} />
        <DrawerFooter config={config} />
      </SheetContent>
    </Sheet>
  );
}
