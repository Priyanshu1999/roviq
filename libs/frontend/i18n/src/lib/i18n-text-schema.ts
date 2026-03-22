import { z } from 'zod';
import { defaultLocale } from './config';

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
    message: `Default locale (${defaultLocale}) translation is required`,
  });

/** Optional i18n field — if provided, must still include default locale */
export const i18nTextOptionalSchema = i18nTextSchema.optional();
