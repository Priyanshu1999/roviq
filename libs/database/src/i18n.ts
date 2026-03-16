/** Extract display string from i18n JSONB — prefers 'en', falls back to first locale */
export function i18nDisplay(value: Record<string, string> | null | undefined): string {
  if (!value) return '';
  const keys = Object.keys(value);
  if (keys.length === 0) return '';
  return value[keys.includes('en') ? 'en' : keys[0]];
}
