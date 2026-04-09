'use client';

import * as React from 'react';

/**
 * SSR-safe media query hook. Returns `false` during SSR and the initial client
 * render, then subscribes to `window.matchMedia` in an effect so the component
 * re-renders with the real value on the client. This matches React's
 * hydration rules — the initial client HTML must equal the server HTML.
 *
 * Used primarily to switch between Dialog (desktop) and Sheet (mobile) shells
 * in response to rule [QIGCL] from frontend-ux.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
