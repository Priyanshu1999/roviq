import type { Locale } from '@roviq/i18n';
import enAcademics from '../../messages/en/academics.json';
import enAcademicYears from '../../messages/en/academicYears.json';
import enAccount from '../../messages/en/account.json';
import enAdminInstitutes from '../../messages/en/adminInstitutes.json';
import enAdminResellers from '../../messages/en/adminResellers.json';
import enAdmission from '../../messages/en/admission.json';
import enAttendance from '../../messages/en/attendance.json';
import enAuditLogs from '../../messages/en/auditLogs.json';
import enAuth from '../../messages/en/auth.json';
import enBilling from '../../messages/en/billing.json';
import enCertificates from '../../messages/en/certificates.json';
import enCommon from '../../messages/en/common.json';
import enConsent from '../../messages/en/consent.json';
import enDashboard from '../../messages/en/dashboard.json';
import enError from '../../messages/en/error.json';
import enGeography from '../../messages/en/geography.json';
import enGroups from '../../messages/en/groups.json';
import enGuardians from '../../messages/en/guardians.json';
import enInstituteBilling from '../../messages/en/instituteBilling.json';
import enInstituteGroups from '../../messages/en/instituteGroups.json';
import enInstituteSettings from '../../messages/en/instituteSettings.json';
import enLocale from '../../messages/en/locale.json';
import enNav from '../../messages/en/nav.json';
import enNotifications from '../../messages/en/notifications.json';
import enObservability from '../../messages/en/observability.json';
import enProfile from '../../messages/en/profile.json';
import enResellerInstitutes from '../../messages/en/resellerInstitutes.json';
import enSelectInstitute from '../../messages/en/selectInstitute.json';
import enSessions from '../../messages/en/sessions.json';
import enStaff from '../../messages/en/staff.json';
import enStudents from '../../messages/en/students.json';
import hiAcademics from '../../messages/hi/academics.json';
import hiAcademicYears from '../../messages/hi/academicYears.json';
import hiAccount from '../../messages/hi/account.json';
import hiAdminInstitutes from '../../messages/hi/adminInstitutes.json';
import hiAdminResellers from '../../messages/hi/adminResellers.json';
import hiAdmission from '../../messages/hi/admission.json';
import hiAttendance from '../../messages/hi/attendance.json';
import hiAuditLogs from '../../messages/hi/auditLogs.json';
import hiAuth from '../../messages/hi/auth.json';
import hiBilling from '../../messages/hi/billing.json';
import hiCertificates from '../../messages/hi/certificates.json';
import hiCommon from '../../messages/hi/common.json';
import hiConsent from '../../messages/hi/consent.json';
import hiDashboard from '../../messages/hi/dashboard.json';
import hiError from '../../messages/hi/error.json';
import hiGeography from '../../messages/hi/geography.json';
import hiGroups from '../../messages/hi/groups.json';
import hiGuardians from '../../messages/hi/guardians.json';
import hiInstituteBilling from '../../messages/hi/instituteBilling.json';
import hiInstituteGroups from '../../messages/hi/instituteGroups.json';
import hiInstituteSettings from '../../messages/hi/instituteSettings.json';
import hiLocale from '../../messages/hi/locale.json';
import hiNav from '../../messages/hi/nav.json';
import hiNotifications from '../../messages/hi/notifications.json';
import hiObservability from '../../messages/hi/observability.json';
import hiProfile from '../../messages/hi/profile.json';
import hiResellerInstitutes from '../../messages/hi/resellerInstitutes.json';
import hiSelectInstitute from '../../messages/hi/selectInstitute.json';
import hiSessions from '../../messages/hi/sessions.json';
import hiStaff from '../../messages/hi/staff.json';
import hiStudents from '../../messages/hi/students.json';

const en = {
  academicYears: enAcademicYears,
  academics: enAcademics,
  account: enAccount,
  attendance: enAttendance,
  adminInstitutes: enAdminInstitutes,
  adminResellers: enAdminResellers,
  admission: enAdmission,
  auditLogs: enAuditLogs,
  auth: enAuth,
  billing: enBilling,
  certificates: enCertificates,
  common: enCommon,
  consent: enConsent,
  dashboard: enDashboard,
  error: enError,
  geography: enGeography,
  groups: enGroups,
  guardians: enGuardians,
  instituteBilling: enInstituteBilling,
  instituteGroups: enInstituteGroups,
  instituteSettings: enInstituteSettings,
  locale: enLocale,
  nav: enNav,
  notifications: enNotifications,
  observability: enObservability,
  profile: enProfile,
  resellerInstitutes: enResellerInstitutes,
  selectInstitute: enSelectInstitute,
  sessions: enSessions,
  staff: enStaff,
  students: enStudents,
} as const;

const hi = {
  academicYears: hiAcademicYears,
  academics: hiAcademics,
  account: hiAccount,
  attendance: hiAttendance,
  adminInstitutes: hiAdminInstitutes,
  adminResellers: hiAdminResellers,
  admission: hiAdmission,
  auditLogs: hiAuditLogs,
  auth: hiAuth,
  billing: hiBilling,
  certificates: hiCertificates,
  common: hiCommon,
  consent: hiConsent,
  dashboard: hiDashboard,
  error: hiError,
  geography: hiGeography,
  groups: hiGroups,
  guardians: hiGuardians,
  instituteBilling: hiInstituteBilling,
  instituteGroups: hiInstituteGroups,
  instituteSettings: hiInstituteSettings,
  locale: hiLocale,
  nav: hiNav,
  notifications: hiNotifications,
  observability: hiObservability,
  profile: hiProfile,
  resellerInstitutes: hiResellerInstitutes,
  selectInstitute: hiSelectInstitute,
  sessions: hiSessions,
  staff: hiStaff,
  students: hiStudents,
} as const;

const MESSAGES: Record<Locale, Record<string, unknown>> = { en, hi };

export function getLocaleMessages(locale: Locale): Record<string, unknown> {
  return MESSAGES[locale];
}
