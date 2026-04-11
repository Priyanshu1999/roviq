'use client';

import { useLocale } from 'next-intl';
import { defaultLocale } from './config';
import type { I18nText } from './i18n-text-schema';

/**
 * Resolves i18n JSONB fields to a display string using the current locale
 * with a fallback chain: current locale → default locale (en) → first available → ''
 *
 * Usage:
 * ```tsx
 * const t = useI18nField();
 * <span>{t(institute.name)}</span>
 * ```
 */
export function useI18nField() {
  const locale = useLocale();
  return function resolveI18n(field: I18nText | string | null | undefined): string {
    if (!field) return '';
    if (typeof field === 'string') return field; // backwards compat — remove after full i18n migration
    return field[locale] ?? field[defaultLocale] ?? Object.values(field)[0] ?? '';
  };
}
