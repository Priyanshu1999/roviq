'use client';

import type { Locale as DateFnsLocale } from 'date-fns';
import { format as dateFnsFormat, formatDistance, formatRelative } from 'date-fns';
import { enIN, hi } from 'date-fns/locale';
import { useLocale } from 'next-intl';

const dateFnsLocales: Record<string, DateFnsLocale> = {
  en: enIN,
  hi: hi,
};

export function useDateLocale() {
  const locale = useLocale();
  return dateFnsLocales[locale] ?? enIN;
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
