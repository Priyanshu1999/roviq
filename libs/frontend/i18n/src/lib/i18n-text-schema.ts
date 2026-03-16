import { z } from 'zod';
import { defaultLocale } from './config';

/**
 * Zod schema for i18n JSONB fields (`Record<string, string>`).
 * Requires the default locale key to be present.
 */
export const i18nTextSchema = z
  .record(z.string().min(2).max(5), z.string().min(1).max(500))
  .refine((obj) => defaultLocale in obj, {
    message: `Default locale (${defaultLocale}) translation is required`,
  });

/** Optional i18n field — if provided, must still include default locale */
export const i18nTextOptionalSchema = i18nTextSchema.optional();
