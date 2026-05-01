'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { testIds } from '../../testing/testid-registry';

const { layout } = testIds;

const SCOPE_SEGMENTS = new Set(['admin', 'reseller', 'institute']);

// Segments without a page.tsx — clicking them 404s.
const CATEGORY_ONLY_SEGMENTS = new Set(['admission', 'people', 'certificates']);

// Persist across hard refresh so the browser-history-aware back logic survives F5.
const NAV_COUNT_KEY = 'roviq:session-nav-count';

function readNavCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(NAV_COUNT_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function bumpNavCount(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(NAV_COUNT_KEY, String(readNavCount() + 1));
  } catch {}
}

/** Convert kebab-case URL segment to camelCase nav key */
function toCamelCase(segment: string): string {
  return segment.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

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
  const router = useRouter();
  const t = useTranslations('nav');
  const currentOverrides = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // count > 1 means an in-session SPA navigation happened, so back is safe.
  useEffect(() => {
    bumpNavCount();
  }, [pathname]);

  const onMobileBack = useCallback(() => {
    if (readNavCount() > 1) {
      router.back();
      return;
    }
    router.push(`/${locale}/dashboard`);
  }, [router, locale]);

  // Filter out locale and scope segments — user sees clean paths
  const segments = pathname
    .split('/')
    .filter((s) => s !== '' && s !== locale && !SCOPE_SEGMENTS.has(s));

  if (segments.length === 0) return null;

  function translateSegment(segment: string): string {
    if (currentOverrides[segment]) return currentOverrides[segment];
    const key = toCamelCase(segment);
    return t.has(key) ? t(key) : formatSegment(segment);
  }

  const currentLabel = translateSegment(segments[segments.length - 1] as string);
  const parentSegments = segments.slice(0, -1);
  const parentHref = parentSegments.length > 0 ? `/${locale}/${parentSegments.join('/')}` : null;
  const parentLabel = parentHref
    ? translateSegment(parentSegments[parentSegments.length - 1] as string)
    : null;

  return (
    <>
      {/* Mobile: back arrow + current segment (or just current at root) */}
      <nav
        aria-label="Breadcrumb"
        data-testid={layout.breadcrumbsMobile}
        className="flex items-center gap-1 text-sm text-muted-foreground md:hidden"
      >
        {parentHref ? (
          <button
            type="button"
            onClick={onMobileBack}
            aria-label={parentLabel ?? 'Back'}
            className="inline-flex h-11 w-11 items-center justify-center -ms-2 rounded-md hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}
        <span className="text-foreground font-medium truncate">{currentLabel}</span>
      </nav>

      {/* Tablet+: full path breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        data-testid={layout.breadcrumbsDesktop}
        className="hidden md:flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link href={`/${locale}/dashboard`} className="hover:text-foreground transition-colors">
          {t('home')}
        </Link>
        {segments.map((segment, index) => {
          const href = `/${locale}/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const label = translateSegment(segment);
          const isCategoryOnly = CATEGORY_ONLY_SEGMENTS.has(segment);
          return (
            <span key={href} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              {isLast ? (
                <span className="text-foreground font-medium">{label}</span>
              ) : isCategoryOnly ? (
                <span>{label}</span>
              ) : (
                <Link href={href} className="hover:text-foreground transition-colors">
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
