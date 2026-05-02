// Two cross-cutting concerns shared by every observability fetcher:
// (a) auto-refresh that pauses when the tab is hidden (review m2),
// (b) a manual "Refresh now" button that forces an immediate refetch
//     across all panels without prop-drilling a nonce (review M4).
//
// Both are exposed as a single `usePollingEffect(run, { refreshMs })` hook
// that wraps the consumer's async fetch fn.

import { useEffect } from 'react';

export const REFRESH_NOW_EVENT = 'roviq:obs-refresh-now';

/**
 * Dispatch from the toolbar's "Refresh now" button. Every active polling
 * hook listens and re-fires `run()` immediately.
 */
export function emitRefreshNow(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REFRESH_NOW_EVENT));
}

interface UsePollingOptions {
  /** Auto-refresh interval in ms. `null` disables auto-refresh. */
  refreshMs: number | null;
  /** Re-run when any of these change (in addition to the initial mount). */
  deps: ReadonlyArray<unknown>;
  /**
   * If false, the hook is a no-op (no initial fetch, no interval, no
   * listeners). Used by `useRangeQuery` to bail when `query === null`.
   */
  enabled?: boolean;
}

/**
 * Runs `run()` once on mount, then on the configured interval.
 * Pauses the interval while `document.hidden` is true.
 * Re-runs immediately on every `roviq:obs-refresh-now` window event.
 */
export function usePollingEffect(
  run: () => void | Promise<void>,
  { refreshMs, deps, enabled = true }: UsePollingOptions,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: callers manage deps via the explicit `deps` array; React's lint rule can't see through it.
  useEffect(() => {
    if (!enabled) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const safeRun = () => {
      if (cancelled || (typeof document !== 'undefined' && document.hidden)) return;
      void run();
    };

    safeRun();

    function startInterval() {
      if (intervalId !== null || refreshMs === null) return;
      intervalId = setInterval(safeRun, refreshMs);
    }
    function stopInterval() {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    }

    if (refreshMs !== null) startInterval();

    function onVisibilityChange() {
      if (document.hidden) {
        stopInterval();
      } else {
        // catch up immediately when the tab becomes visible again
        safeRun();
        startInterval();
      }
    }
    function onRefreshNow() {
      void run();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_NOW_EVENT, onRefreshNow);
    }

    return () => {
      cancelled = true;
      stopInterval();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener(REFRESH_NOW_EVENT, onRefreshNow);
      }
    };
  }, [refreshMs, enabled, ...deps]);
}
