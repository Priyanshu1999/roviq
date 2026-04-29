'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { cn } from '../../lib/utils';
import { useAbility } from '../auth/ability-provider';
import { useSidebar } from './sidebar';
import type { BottomNavConfig, NavRegistryEntry } from './types';

interface BottomTabBarProps {
  bottomNav: BottomNavConfig;
  navRegistry: Record<string, NavRegistryEntry>;
}

interface ResolvedTab {
  slug: string;
  href: string;
  label: string;
  icon: NavRegistryEntry['icon'];
}

const MAX_TABS = 4;

/**
 * Phone + tablet bottom tab bar. Renders below the `xl` breakpoint (1280 px)
 * as a fixed bar with up to 4 destination tabs (resolved from the user's
 * role-level slug list) plus a "More" trigger that opens the existing sidebar
 * drawer.
 *
 * Pairs with `DesktopSidebar` (visible only at `xl+`) — together they cover
 * the full responsive range without doubling up.
 *
 * Ability-gated: any slug whose `ability` the current user lacks is silently
 * dropped from the bar (the slot is not reserved).
 */
export function BottomTabBar({ bottomNav, navRegistry }: BottomTabBarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const ability = useAbility();
  const { setMobileOpen } = useSidebar();

  const sourceSlugs = bottomNav.slugs.length > 0 ? bottomNav.slugs : bottomNav.defaultSlugs;
  const tabs: ResolvedTab[] = sourceSlugs
    .map((slug) => {
      const entry = navRegistry[slug];
      if (!entry) return null;
      if (entry.ability && !ability.can(entry.ability.action, entry.ability.subject)) {
        return null;
      }
      return { slug, href: entry.href, label: entry.label, icon: entry.icon };
    })
    .filter((t): t is ResolvedTab => t !== null)
    .slice(0, MAX_TABS);

  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-tab-bar"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex border-t bg-background xl:hidden',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {tabs.map((tab) => {
        const localizedHref = `/${locale}${tab.href}`;
        const isActive = pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.slug}
            href={localizedHref}
            data-testid={`bottom-tab-${tab.slug}`}
            data-active={isActive ? 'true' : 'false'}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs',
              isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="leading-none">{tab.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        data-testid="bottom-tab-more"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground"
      >
        <Menu className="size-5" aria-hidden="true" />
        <span className="leading-none">{bottomNav.moreLabel}</span>
      </button>
    </nav>
  );
}
