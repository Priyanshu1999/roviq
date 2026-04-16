'use client';

import type { Locale as DateFnsLocale } from 'date-fns';
import { format as dateFnsFormat, formatDistance, formatRelative } from 'date-fns';
import { enIN, hi } from 'date-fns/locale';
import { useLocale } from 'next-intl';

// When adding a new locale to `supportedLocales`, you MUST also:
//   1. Import the date-fns locale here and add it to `dateFnsLocales`.
//   2. Add the Intl locale string mapping in `useFormatNumber` below.
//
// Future locale imports needed (uncomment + add to map when supported):
//   import { bn } from 'date-fns/locale';  // Bengali
//   import { ta } from 'date-fns/locale';  // Tamil
//   import { mr } from 'date-fns/locale';  // Marathi
//   import { te } from 'date-fns/locale';  // Telugu
//   import { kn } from 'date-fns/locale';  // Kannada
//   import { gu } from 'date-fns/locale';  // Gujarati
const dateFnsLocales: Record<string, DateFnsLocale> = {
  en: enIN,
  hi: hi,
  // bn, ta, mr, te, kn, gu — add entries here when locales ship
};

export function useDateLocale() {
  const locale = useLocale();
  const resolved = dateFnsLocales[locale];
  if (!resolved && process.env.NODE_ENV === 'development') {
    console.warn(
      `[useFormatDate] No date-fns locale for "${locale}" — falling back to enIN. ` +
        'Add an import and entry in libs/frontend/i18n/src/lib/formatting.ts.',
    );
  }
  return resolved ?? enIN;
}

export function useFormatDate() {
  const dateLocale = useDateLocale();

  return {
    format: (date: Date | number, formatStr: string) =>
      dateFnsFormat(date, formatStr, { locale: dateLocale }),
    formatDistance: (date: Date | number, baseDate: Date | number) =>
      formatDistance(date, baseDate, { locale: dateLocale, addSuffix: true }),
    formatRelative: (date: Date | number, baseDate: Date | number) =>
      formatRelative(date, baseDate, { locale: dateLocale }),
  };
}

export function useFormatNumber() {
  const locale = useLocale();
  const intlLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';

  return {
    format: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(intlLocale, options).format(value),
    currency: (value: number, currency = 'INR') =>
      new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(value),
    percent: (value: number) =>
      new Intl.NumberFormat(intlLocale, { style: 'percent' }).format(value),
  };
}
