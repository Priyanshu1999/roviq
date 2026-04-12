import { z } from 'zod';
import { defaultLocale } from './config';

/** Multi-language text stored as `{ locale: text }`, e.g. `{ "en": "Science", "hi": "विज्ञान" }`. */
export type I18nText = Record<string, string>;

/**
 * Zod schema for i18n JSONB fields (`Record<string, string>`).
 * Requires the default locale key to be present.
 */
export const i18nTextSchema = z
  .record(z.string().min(2).max(5), z.string().max(500))
  .transform((obj) => {
    // Strip empty/whitespace-only non-default locale values
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === defaultLocale || value.trim().length > 0) {
        result[key] = value;
      }
    }
    return result;
  })
  .refine((obj) => defaultLocale in obj && obj[defaultLocale].trim().length > 0, {
    // Attach the error to the default-locale sub-path so per-field subscriptions
    // (react-hook-form's `useController` or TanStack Form's nested `form.Field`)
    // on `${name}.${defaultLocale}` pick it up. The message is intentionally
    // short and neutral; forms that want a domain-specific string should build
    // their own schema via `buildI18nTextSchema(message)` below.
    path: [defaultLocale],
    message: 'Required',
  });

/**
 * Build an `i18nTextSchema` variant with a custom "required" message — use
 * this when a page can supply a translated label via `useTranslations()`
 * (e.g. "First name is required"). The validation rules are otherwise
 * identical to the default export.
 */
export function buildI18nTextSchema(message: string) {
  return z
    .record(z.string().min(2).max(5), z.string().max(500))
    .transform((obj) => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === defaultLocale || value.trim().length > 0) {
          result[key] = value;
        }
      }
      return result;
    })
    .refine((obj) => defaultLocale in obj && obj[defaultLocale].trim().length > 0, {
      path: [defaultLocale],
      message,
    });
}

/**
 * Optional i18n field — accepts `undefined`, all-empty, or all-undefined values
 * (which I18nInput produces when the user leaves all locale fields blank).
 * Non-empty values must still include a non-empty default locale.
 */
export const i18nTextOptionalSchema = z
  .record(z.string().min(2).max(5), z.string().max(500).or(z.undefined()))
  .optional()
  .transform((obj) => {
    if (!obj) return undefined;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        result[key] = value;
      }
    }
    if (Object.keys(result).length === 0) return undefined;
    return result;
  })
  .refine(
    (obj) => obj === undefined || (defaultLocale in obj && obj[defaultLocale].trim().length > 0),
    { path: [defaultLocale], message: 'Required' },
  );
