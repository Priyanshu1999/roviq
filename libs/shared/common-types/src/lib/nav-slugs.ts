/**
 * Stable identifiers for navigation destinations across the web app.
 *
 * Stored in `roles.primary_nav_slugs` (DB) and resolved on the frontend through
 * a per-portal `navRegistry` to `{ href, icon, labelKey }`. Decouples persisted
 * configuration from URL/icon/label changes — renaming a route never requires
 * a DB migration.
 */
export const NAV_SLUGS = {
  // Institute scope
  dashboard: 'dashboard',
  students: 'students',
  staff: 'staff',
  guardians: 'guardians',
  groups: 'groups',
  enquiries: 'enquiries',
  applications: 'applications',
  statistics: 'statistics',
  academicYears: 'academicYears',
  academics: 'academics',
  standards: 'standards',
  timetable: 'timetable',
  tc: 'tc',
  certificates: 'certificates',
  subscriptions: 'subscriptions',
  invoices: 'invoices',
  payments: 'payments',
  audit: 'audit',
  settings: 'settings',
  notifications: 'notifications',
  consent: 'consent',
  profile: 'profile',
  account: 'account',

  // Reseller / admin scope
  institutes: 'institutes',
  resellers: 'resellers',
  team: 'team',
  billing: 'billing',
} as const;

export type NavSlug = (typeof NAV_SLUGS)[keyof typeof NAV_SLUGS];

export const ALL_NAV_SLUGS: readonly NavSlug[] = Object.freeze(
  Object.values(NAV_SLUGS) as NavSlug[],
);

/** Maximum number of slugs that can be promoted to the phone bottom tab bar. */
export const MAX_PRIMARY_NAV_SLUGS = 4;

export function isNavSlug(value: unknown): value is NavSlug {
  return typeof value === 'string' && (ALL_NAV_SLUGS as readonly string[]).includes(value);
}
