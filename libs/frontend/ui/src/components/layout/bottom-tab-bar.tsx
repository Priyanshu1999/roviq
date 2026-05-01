'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { testIds } from '../../testing/testid-registry';
import { useAbility } from '../auth/ability-provider';
import { useSidebar } from './sidebar';
import type { BottomNavConfig, NavRegistryEntry } from './types';

const { layout } = testIds;

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

interface IndicatorRect {
  left: number;
  width: number;
  visible: boolean;
}

const MAX_TABS = 4;

// SSR-safe useLayoutEffect — silences Next.js warning during prerender.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
 *
 * iOS-feel polish:
 * - Single absolutely-positioned indicator pill that *slides* between active
 *   tabs (300ms cubic-bezier ease-out) rather than snapping. Computed via
 *   `offsetLeft` / `offsetWidth` of the active item, kept in sync with a
 *   ResizeObserver on the nav container.
 * - Press feedback: subtle `:active` scale-down for haptic-like response.
 * - Active tab gets a -1px lift + slight icon scale to suggest depth.
 * - Glass surface uses heavier blur + saturation, plus a soft top inset
 *   highlight to mimic iOS 18 liquid glass.
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

  // Pick the tab whose href is the longest prefix of the current pathname.
  // Otherwise a parent route (e.g. /people) would highlight while the user is
  // on a child (e.g. /people/staff) that has its own tab.
  const matchingHrefs = tabs
    .map((t) => {
      const localized = `/${locale}${t.href}`;
      const matches =
        pathname === t.href ||
        pathname.startsWith(`${t.href}/`) ||
        pathname === localized ||
        pathname.startsWith(`${localized}/`);
      return matches ? t.href : null;
    })
    .filter((h): h is string => h !== null);
  const activeHref = matchingHrefs.sort((a, b) => b.length - a.length)[0] ?? null;

  // ── Single-pill iOS magic-move ───────────────────────────────────────────
  // One pill that always lives at the active tab. Two motions run in
  // parallel on each tab switch:
  //   1. CSS transition on `left`/`width` slides the pill from old position
  //      to new position (300ms cubic-bezier).
  //   2. A scale + opacity keyframe (driven via Web Animations API) plays in
  //      sync — pill swells slightly and dims at the midpoint, then settles
  //      back at the new position. This matches iOS App Store's "stretch +
  //      ghost" feel during tab transitions.
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const [indicator, setIndicator] = useState<IndicatorRect>({
    left: 0,
    width: 0,
    visible: false,
  });
  // Suppress the slide on the very first paint so the pill doesn't fly in.
  const [animateIndicator, setAnimateIndicator] = useState(false);

  const setItemRef = useCallback(
    (href: string) => (el: HTMLElement | null) => {
      if (el) {
        itemRefs.current.set(href, el);
      } else {
        itemRefs.current.delete(href);
      }
    },
    [],
  );

  // Pill is INTENTIONALLY wider than the tab cell — a negative inset extends
  // it past the cell edges so the active highlight has visible breathing room
  // around the icon + label, instead of looking choked at the cell boundary.
  const PILL_INSET = -2;
  const measure = useCallback(() => {
    if (!activeHref) {
      setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const el = itemRefs.current.get(activeHref);
    const nav = navRef.current;
    if (!el || !nav) return;
    const left = el.offsetLeft + PILL_INSET;
    const width = el.offsetWidth - PILL_INSET * 2;
    setIndicator((prev) =>
      prev.visible && prev.left === left && prev.width === width
        ? prev
        : { left, width, visible: true },
    );
  }, [activeHref]);

  useIsoLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setAnimateIndicator(true));
    return () => cancelAnimationFrame(id);
  }, [measure]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  // On every active-tab change (after the first paint), play a parallel
  // scale + opacity "morph" via Web Animations API. The CSS `transition` on
  // `left`/`width` handles the horizontal slide; this animate() call handles
  // the simultaneous stretch + dim so the user sees one continuous motion.
  const isFirstMorphRef = useRef(true);
  useEffect(() => {
    if (!activeHref) return;
    if (isFirstMorphRef.current) {
      isFirstMorphRef.current = false;
      return;
    }
    // Honor prefers-reduced-motion: skip the WAAPI scale/opacity morph on the
    // pill and the bar "breath" zoom. The CSS transition on left/width is
    // kept — it's low-motion and useful for spatial orientation.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const el = pillRef.current;
    if (!el || typeof el.animate !== 'function') return;
    // Timing: scale-up happens between 0%–18% of the timeline, the pill
    // holds at 2x stretch from 18% through 82% (most of the travel), then
    // scale-down between 82%–100%. Mimics a rubber band grabbing the new
    // tab and snapping back.
    // Symmetric 3-D-glass glow during the held-stretch phase. No directional
    // lighting — all four inner edges share the same bright highlight, plus
    // a uniform outer ring + halo so the pill reads as a glowing object lit
    // from every side rather than a surface lit from above.
    const glassShadow = [
      'inset 0 1px 3px -1px rgba(255,255,255,0.45)',
      'inset 0 -1px 3px -1px rgba(255,255,255,0.45)',
      'inset 1px 0 3px -1px rgba(255,255,255,0.45)',
      'inset -1px 0 3px -1px rgba(255,255,255,0.45)',
      '0 0 0 1px rgba(255,255,255,0.30)',
      '0 0 16px 2px rgba(255,255,255,0.18)',
    ].join(', ');

    el.animate(
      [
        {
          transform: 'scale(1, 1)',
          opacity: 1,
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.45)',
          offset: 0,
        },
        {
          transform: 'scale(1, 1.2)',
          opacity: 0.45,
          boxShadow: glassShadow,
          offset: 0.18,
        },
        {
          transform: 'scale(1, 1.2)',
          opacity: 0.45,
          boxShadow: glassShadow,
          offset: 0.82,
        },
        {
          transform: 'scale(1, 1)',
          opacity: 1,
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.45)',
          offset: 1,
        },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.32, 0.72, 0.16, 1)',
        fill: 'none',
      },
    );

    // Whole bar gets a subtle "breath" zoom on every tab change — quick
    // scale-up then settles back. Adds tactile feedback that the tap
    // registered without overpowering the pill morph.
    const navEl = navRef.current;
    if (navEl && typeof navEl.animate === 'function') {
      navEl.animate(
        [
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1.03)', offset: 0.4 },
          { transform: 'scale(1)', offset: 1 },
        ],
        {
          duration: 240,
          easing: 'cubic-bezier(0.32, 0.72, 0.16, 1)',
          fill: 'none',
        },
      );
    }
  }, [activeHref]);

  // ── Scroll-minimize (iOS 26 signature behavior) ─────────────────────────
  // When the user scrolls down, collapse the bar to icon-only (drop the
  // labels) and shrink it slightly. When they scroll up — even a little —
  // expand back. Pure listener, no library.
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastY = window.scrollY;
    let lastScroller: Element | Window = window;
    const main = document.querySelector('main');
    const scroller: Element | Window = main ?? window;
    lastScroller = scroller;
    const getY = () =>
      lastScroller === window ? window.scrollY : (lastScroller as Element).scrollTop;
    lastY = getY();

    const onScroll = () => {
      const y = getY();
      const dy = y - lastY;
      // Only react to noticeable deltas — avoids jitter at the boundary
      // and during momentum on iOS.
      if (Math.abs(dy) < 6) return;
      if (dy > 0 && y > 80) {
        setMinimized(true);
      } else if (dy < 0) {
        setMinimized(false);
      }
      lastY = y;
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-2 xl:hidden',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
      )}
    >
      <nav
        ref={navRef}
        aria-label="Primary"
        data-testid={layout.bottomTabBar}
        data-minimized={minimized ? 'true' : 'false'}
        className={cn(
          'pointer-events-auto relative flex w-full max-w-2xl items-stretch gap-0.5 rounded-[31px] px-1 py-1',
          // iOS-style "ultra thin material": low-opacity surface tint + heavy
          // blur + saturation boost + brightness shift. Together they form a
          // visibly translucent layer where blurred content behind the bar
          // shows through with a frosted lens. Light mode dims (brightness-90)
          // for legible text over bright pages; dark mode brightens (110)
          // for the lit-glass look.
          'border border-white/10 bg-transparent shadow-[0_4px_16px_-8px_rgba(0,0,0,0.18)] backdrop-blur-md',
          'dark:border-white/[0.04] dark:backdrop-brightness-110',
          // Springy minimize/expand transition.
          'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0.16,1)]',
        )}
      >
        {/* Top inner highlight — non-interactive, decorative only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/15"
        />
        {/* Bottom edge subtle shadow line — adds glass-on-glass depth. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/5"
        />

        {/* iOS magic-move indicator: a single pill that slides between tabs
            via CSS transition on `left`/`width` while a parallel scale +
            opacity keyframe (driven by Web Animations API in a useEffect)
            makes it stretch + dim at the midpoint and settle at the new
            position. One element, two simultaneous motions. */}
        <span
          ref={pillRef}
          aria-hidden="true"
          data-testid={layout.bottomTabIndicator}
          className={cn(
            'pointer-events-none absolute top-[3px] bottom-[3px] rounded-[1.75rem] bg-foreground/[0.10] dark:bg-foreground/[0.14]',
            'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
            animateIndicator &&
              'transition-[left,width] duration-300 ease-[cubic-bezier(0.32,0.72,0.16,1)]',
          )}
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.visible ? 1 : 0,
          }}
        />

        {tabs.map((tab) => {
          const localizedHref = `/${locale}${tab.href}`;
          const isActive = activeHref === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.slug}
              ref={setItemRef(tab.href)}
              href={localizedHref}
              // Bottom-tab routes are the user's primary destinations and the
              // bar sits permanently in the viewport, so explicitly opt into
              // prefetch — keeps tap-to-paint instant on slow mobile networks.
              prefetch={true}
              data-testid={layout.bottomTab(tab.slug)}
              data-active={isActive ? 'true' : 'false'}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // Layout — 5 tabs must fit at 360px; icon-only below sm,
                // label at sm+. iOS-style press feedback via active: classes.
                'group relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[10px] font-medium leading-none',
                'transition-[color,transform] duration-300 ease-out',
                'active:scale-[0.94] active:opacity-80',
                // Active = brand primary color (matches the rest of the
                // app's accent surfaces). Inactive = muted-foreground.
                isActive ? 'text-primary' : 'text-muted-foreground',
                !isActive && 'hover:text-foreground/80',
              )}
            >
              <Icon
                className={cn(
                  'size-[22px] shrink-0 transition-transform duration-300 ease-out',
                  isActive ? 'scale-105' : 'scale-100',
                )}
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'block max-w-full truncate transition-[opacity,max-height] duration-200 ease-out',
                  minimized ? 'sr-only' : 'opacity-100',
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          data-testid={layout.bottomTabMore}
          className={cn(
            'group relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[10px] font-medium leading-none text-muted-foreground',
            'transition-[color,transform] duration-300 ease-out',
            'hover:text-foreground/80 active:scale-[0.94] active:opacity-80',
          )}
        >
          <Menu className="size-[22px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span
            className={cn(
              'block max-w-full truncate transition-[opacity,max-height] duration-200 ease-out',
              minimized ? 'sr-only' : 'opacity-100',
            )}
          >
            {bottomNav.moreLabel}
          </span>
        </button>
      </nav>
    </div>
  );
}
