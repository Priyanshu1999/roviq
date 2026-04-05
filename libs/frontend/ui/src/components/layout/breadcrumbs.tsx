'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';

const SCOPE_SEGMENTS = new Set(['admin', 'reseller', 'institute']);

function formatSegment(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Breadcrumb override store ────────────────────────────────
// Module-level store so page components (children) can set labels
// that the Breadcrumbs component (in a parent layout) reads.
// Uses useSyncExternalStore for React-safe concurrent rendering.
// Pattern from: https://www.gcasc.io/blog/next-dynamic-breadcrumbs

type BreadcrumbOverrides = Record<string, string>;

let overrides: BreadcrumbOverrides = {};
const listeners = new Set<() => void>();

function getSnapshot(): BreadcrumbOverrides {
  return overrides;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setOverrides(next: BreadcrumbOverrides): void {
  overrides = { ...overrides, ...next };
  for (const l of listeners) l();
}

function clearOverrides(keys: string[]): void {
  const copy = { ...overrides };
  for (const k of keys) delete copy[k];
  overrides = copy;
  for (const l of listeners) l();
}

/**
 * Set custom breadcrumb labels from any page component.
 * The Breadcrumbs component (rendered in a parent layout) reads these.
 * Overrides are cleaned up when the component unmounts.
 *
 * @example
 * ```tsx
 * // In a [id] page component:
 * useBreadcrumbOverride({ [id]: instituteName });
 * ```
 */
export function useBreadcrumbOverride(labels: BreadcrumbOverrides): void {
  useEffect(() => {
    setOverrides(labels);
    return () => clearOverrides(Object.keys(labels));
  }, [JSON.stringify(labels)]);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const locale = useLocale();
  const currentOverrides = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Filter out locale and scope segments — user sees clean paths
  const segments = pathname
    .split('/')
    .filter((s) => s !== '' && s !== locale && !SCOPE_SEGMENTS.has(s));

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">
        Home
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const label = currentOverrides[segment] ?? formatSegment(segment);
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
