import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';
import { routing } from './routing';

export function createRequestConfig(
  loadMessages: (locale: string) => Promise<Record<string, unknown>>,
) {
  return getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!hasLocale(routing.locales, locale)) {
      locale = routing.defaultLocale;
    }

    const messages = await loadMessages(locale);

    // Load English messages as fallback for missing keys in non-English locales
    const fallbackMessages = locale !== defaultLocale ? await loadMessages(defaultLocale) : {};

    return {
      locale,
      messages: { ...fallbackMessages, ...messages },
      formats: {
        dateTime: {
          short: { day: 'numeric', month: 'short', year: 'numeric' },
          long: { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' },
        },
        number: {
          currency: { style: 'currency', currency: 'INR' },
          percent: { style: 'percent' },
        },
      },
    };
  });
}
