import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getLocaleMessages } from '../messages';

// Hardcoded to avoid pulling `@roviq/i18n` (and its next-intl server deps)
// into a DOM spec. Any new locale must be added both here and in the loader.
const locales = ['en', 'hi'] as const;

/**
 * Completeness guard for the message loader.
 *
 * The loader in `messages.ts` drives both production (via `request.ts`) and
 * component tests (via `renderWithProviders`). This spec asserts:
 *
 *  1. Every `messages/<locale>/*.json` file is exposed — catches the drift
 *     bug where someone adds a JSON namespace but forgets to wire it into
 *     the loader (silently breaks `useTranslations('<ns>')` at runtime).
 *  2. All locales expose the same top-level namespaces — catches translator
 *     drift where `en` has a namespace but `hi` doesn't, or vice versa.
 */
const MESSAGES_ROOT = join(__dirname, '../../../messages');

function filesystemNamespaces(locale: string): string[] {
  return readdirSync(join(MESSAGES_ROOT, locale))
    .filter((f) => f.endsWith('.json'))
    .map((f) => basename(f, '.json'))
    .sort();
}

describe('i18n message loader', () => {
  for (const locale of locales) {
    it(`exposes every ${locale} JSON namespace on disk`, () => {
      const onDisk = filesystemNamespaces(locale);
      const loaded = Object.keys(getLocaleMessages(locale)).sort();
      expect(loaded).toEqual(onDisk);
    });
  }

  it('has identical top-level namespaces across all locales', () => {
    const byLocale = Object.fromEntries(
      locales.map((l) => [l, Object.keys(getLocaleMessages(l)).sort()]),
    );
    const reference = byLocale[locales[0]];
    for (const locale of locales.slice(1)) {
      expect(byLocale[locale]).toEqual(reference);
    }
  });
});
