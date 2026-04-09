export type { Locale } from './lib/config';
export { defaultLocale, localeLabels, locales, rtlLocales } from './lib/config';
export { useDateLocale, useFormatDate, useFormatNumber } from './lib/formatting';
export {
  buildI18nTextSchema,
  i18nTextOptionalSchema,
  i18nTextSchema,
} from './lib/i18n-text-schema';
// NOTE: `intlMiddleware` / `intlMatcherConfig` intentionally NOT re-exported from
// this barrel. They pull in `next-intl/middleware` → `next/server`, which is a
// server-only runtime and breaks both happy-dom unit tests and client bundles.
// If a consumer needs them, import directly from '@roviq/i18n/lib/middleware'
// (or split into a dedicated '@roviq/i18n/server' entry point if that grows).
export { getPathname, Link, redirect, usePathname, useRouter } from './lib/navigation';
export { createRequestConfig } from './lib/request';
export { routing } from './lib/routing';
export { useI18nField } from './lib/use-i18n-field';
