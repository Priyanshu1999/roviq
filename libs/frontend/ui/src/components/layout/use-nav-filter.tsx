'use client';

import * as React from 'react';
import type { NavGroup } from './types';

/**
 * Filter `navGroups` by case-insensitive substring match against item titles.
 * Empty query returns the original groups unchanged. Empty groups (after
 * filtering) are dropped so we don't render orphan headings.
 */
export function useNavFilter(navGroups: NavGroup[], query: string): NavGroup[] {
  return React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navGroups;
    const out: NavGroup[] = [];
    for (const group of navGroups) {
      const items = group.items.filter((item) => item.title.toLowerCase().includes(q));
      if (items.length > 0) out.push({ title: group.title, items });
    }
    return out;
  }, [navGroups, query]);
}

/**
 * Renders `text` with all case-insensitive occurrences of `match` wrapped in
 * `<mark>`. Splits-and-maps to keep React safe — no innerHTML / sanitization
 * concerns. When `match` is empty, returns plain text.
 */
export function HighlightedText({
  text,
  match,
}: {
  text: string;
  match: string;
}): React.ReactElement {
  const m = match.trim();
  if (!m) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = m.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={`m-${key++}`}>{text.slice(idx, idx + needle.length)}</mark>);
    i = idx + needle.length;
  }
  return <>{parts}</>;
}
