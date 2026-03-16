import { createRequestConfig } from '@roviq/i18n';

export default createRequestConfig(async (locale) => {
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const nav = (await import(`../../messages/${locale}/nav.json`)).default;
  const auth = (await import(`../../messages/${locale}/auth.json`)).default;
  const dashboard = (await import(`../../messages/${locale}/dashboard.json`)).default;
  const selectInstitute = (await import(`../../messages/${locale}/selectInstitute.json`)).default;
  const localeMessages = (await import(`../../messages/${locale}/locale.json`)).default;
  const error = (await import(`../../messages/${locale}/error.json`)).default;
  const observability = (await import(`../../messages/${locale}/observability.json`)).default;
  const auditLogs = (await import(`../../messages/${locale}/auditLogs.json`)).default;
  const account = (await import(`../../messages/${locale}/account.json`)).default;
  const billing = (await import(`../../messages/${locale}/billing.json`)).default;

  return {
    common,
    nav,
    auth,
    dashboard,
    selectInstitute,
    locale: localeMessages,
    error,
    observability,
    auditLogs,
    account,
    billing,
  };
});
