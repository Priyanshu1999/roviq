import { createRequestConfig } from '@roviq/i18n';

export default createRequestConfig(async (locale) => {
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const nav = (await import(`../../messages/${locale}/nav.json`)).default;
  const auth = (await import(`../../messages/${locale}/auth.json`)).default;
  const dashboard = (await import(`../../messages/${locale}/dashboard.json`)).default;
  const selectOrg = (await import(`../../messages/${locale}/selectOrg.json`)).default;
  const localeMessages = (await import(`../../messages/${locale}/locale.json`)).default;
  const error = (await import(`../../messages/${locale}/error.json`)).default;

  return { common, nav, auth, dashboard, selectOrg, locale: localeMessages, error };
});
