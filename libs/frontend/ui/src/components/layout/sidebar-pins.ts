'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';
import { pickActiveHref } from './sidebar';
import type { NavItem } from './types';

// LocalStorage keys + caps. Versioned via the `roviq:` prefix so we can bump
// names cleanly later if the schema evolves.
export const PINS_KEY = 'roviq:nav-pins';
export const RECENTS_KEY = 'roviq:nav-recents';
export const PINS_CAP = 5;
export const RECENTS_CAP = 5;

export interface RecentEntry {
  href: string;
  ts: number;
}

// ── Singleton pin store ────────────────────────────────────────────────────
// useSyncExternalStore needs a stable subscribe + getSnapshot pair; building a
// tiny module-singleton avoids re-creating subscribers per hook instance and
// gives us cross-tab sync via the `storage` event for free.
type Listener = () => void;
const listeners = new Set<Listener>();
let pinsCache: string[] = readPinsFromStorage();

function readPinsFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, PINS_CAP);
  } catch {
    return [];
  }
}

function writePinsToStorage(next: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PINS_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / disabled storage; in-memory cache still updates.
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Cross-tab sync — another tab writing to localStorage fires `storage`.
  const onStorage = (e: StorageEvent) => {
    if (e.key === PINS_KEY) {
      pinsCache = readPinsFromStorage();
      emit();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getSnapshot(): string[] {
  return pinsCache;
}

function getServerSnapshot(): string[] {
  return [];
}

function setPins(next: string[]): void {
  pinsCache = next.slice(0, PINS_CAP);
  writePinsToStorage(pinsCache);
  emit();
}

export interface UsePinsResult {
  pins: string[];
  pin: (href: string) => void;
  unpin: (href: string) => void;
  isPinned: (href: string) => boolean;
}

export function usePins(): UsePinsResult {
  const pins = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pin = React.useCallback((href: string) => {
    if (pinsCache.includes(href)) return;
    // Cap eviction — drop the oldest (front) entry so newest pin wins.
    const next = [...pinsCache, href];
    if (next.length > PINS_CAP) next.shift();
    setPins(next);
  }, []);

  const unpin = React.useCallback((href: string) => {
    if (!pinsCache.includes(href)) return;
    setPins(pinsCache.filter((h) => h !== href));
  }, []);

  const isPinned = React.useCallback((href: string) => pins.includes(href), [pins]);

  return { pins, pin, unpin, isPinned };
}

// ── Recents (per-tab; LRU capped) ──────────────────────────────────────────
function readRecentsFromStorage(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is RecentEntry =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as RecentEntry).href === 'string' &&
          typeof (v as RecentEntry).ts === 'number',
      )
      .slice(0, RECENTS_CAP);
  } catch {
    return [];
  }
}

function writeRecentsToStorage(next: RecentEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / disabled storage.
  }
}

/**
 * Track the user's last-visited nav items for the Recents section. Listens to
 * pathname changes; the current pathname's matching item is excluded from the
 * returned list so we never show "you are here" as a shortcut.
 */
export function useRecents(allItems: NavItem[]): NavItem[] {
  const pathname = usePathname();
  const [recents, setRecents] = React.useState<RecentEntry[]>(() => readRecentsFromStorage());

  // Cheap href→item map for lookup post-pathname change.
  const itemByHref = React.useMemo(() => {
    const map = new Map<string, NavItem>();
    for (const it of allItems) map.set(it.href, it);
    return map;
  }, [allItems]);

  // Locale-agnostic match: pathname may carry a `/en` prefix while nav items
  // use unprefixed hrefs. Reuse pickActiveHref's longest-prefix logic — we pass
  // an empty locale because pathname could be either form.
  const matchedHref = React.useMemo(() => {
    const hrefs = allItems.map((i) => i.href);
    // Try each known locale segment; default to '' so unprefixed paths match.
    const localeSegment = pathname.split('/')[1] ?? '';
    return pickActiveHref(hrefs, pathname, localeSegment);
  }, [pathname, allItems]);

  React.useEffect(() => {
    if (!matchedHref) return;
    setRecents((prev) => {
      const without = prev.filter((r) => r.href !== matchedHref);
      const next = [{ href: matchedHref, ts: Date.now() }, ...without].slice(0, RECENTS_CAP);
      writeRecentsToStorage(next);
      return next;
    });
  }, [matchedHref]);

  return React.useMemo(
    () =>
      recents
        .filter((r) => r.href !== matchedHref)
        .map((r) => itemByHref.get(r.href))
        .filter((it): it is NavItem => it !== undefined),
    [recents, matchedHref, itemByHref],
  );
}
