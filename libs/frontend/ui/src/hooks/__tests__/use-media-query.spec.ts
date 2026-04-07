import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../use-media-query';

let listeners: Map<string, (event: MediaQueryListEvent) => void>;
let matchesMap: Map<string, boolean>;

beforeEach(() => {
  listeners = new Map();
  matchesMap = new Map();

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matchesMap.get(query) ?? false,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.set(query, cb),
      removeEventListener: (_: string, _cb: (e: MediaQueryListEvent) => void) =>
        listeners.delete(query),
    })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('returns false on initial render (SSR-safe)', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    // Initial useState(false) before useEffect runs
    expect(result.current).toBe(false);
  });

  it('returns true when media query matches', () => {
    matchesMap.set('(min-width: 768px)', true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when media query does not match', () => {
    matchesMap.set('(min-width: 768px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    matchesMap.set('(min-width: 768px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);

    act(() => {
      const listener = listeners.get('(min-width: 768px)');
      listener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(listeners.has('(min-width: 768px)')).toBe(true);

    unmount();
    expect(listeners.has('(min-width: 768px)')).toBe(false);
  });

  it('re-subscribes when query changes', () => {
    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(min-width: 768px)' },
    });

    expect(listeners.has('(min-width: 768px)')).toBe(true);

    rerender({ query: '(min-width: 1024px)' });
    expect(listeners.has('(min-width: 768px)')).toBe(false);
    expect(listeners.has('(min-width: 1024px)')).toBe(true);
  });
});
