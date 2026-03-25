import { createRequestConfig } from '@roviq/i18n';

export default createRequestConfig(async (locale) => {
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const nav = (await import(`../../messages/${locale}/nav.json`)).default;
  const auth = (await import(`../../messages/${locale}/auth.json`)).default;
  const dashboard = (await import(`../../messages/${locale}/dashboard.json`)).default;
  const selectInstitute = (await import(`../../messages/${locale}/selectInstitute.json`)).default;
  const localeMessages = (await import(`../../messages/${locale}/locale.json`)).default;
  const error = (await import(`../../messages/${locale}/error.json`)).default;
  const account = (await import(`../../messages/${locale}/account.json`)).default;
  const notifications = (await import(`../../messages/${locale}/notifications.json`)).default;
  const auditLogs = (await import(`../../messages/${locale}/auditLogs.json`)).default;
  const billing = (await import(`../../messages/${locale}/billing.json`)).default;
  const instituteBilling = (await import(`../../messages/${locale}/instituteBilling.json`)).default;
  const observability = (await import(`../../messages/${locale}/observability.json`)).default;
  const sessions = (await import(`../../messages/${locale}/sessions.json`)).default;
  const academicYears = (await import(`../../messages/${locale}/academicYears.json`)).default;
  const instituteSettings = (await import(`../../messages/${locale}/instituteSettings.json`))
    .default;
  const academics = (await import(`../../messages/${locale}/academics.json`)).default;
  const instituteGroups = (await import(`../../messages/${locale}/instituteGroups.json`)).default;

  return {
    common,
    nav,
    auth,
    dashboard,
    selectInstitute,
    locale: localeMessages,
    error,
    account,
    notifications,
    sessions,
    auditLogs,
    billing,
    instituteBilling,
    observability,
    academicYears,
    instituteSettings,
    academics,
    instituteGroups,
  };
});
