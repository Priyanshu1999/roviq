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
  attendance: 'attendance',
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

/**
 * Curated default bottom-tab-bar slugs (max 4) per system-seeded institute role.
 * Keyed by the role's English `name.en` (the seeded role-template key, e.g.
 * `class_teacher`). Roles not in this map fall back to the per-portal
 * `defaultSlugs`. Mirrored in the backend seed (`libs/backend/casl/src/seed-roles.ts`)
 * so the frontend can offer a "Reset to default" without crossing the backend
 * boundary.
 */
export const DEFAULT_PRIMARY_NAV_SLUGS: Readonly<Record<string, readonly NavSlug[]>> =
  Object.freeze({
    institute_admin: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.students,
      NAV_SLUGS.enquiries,
      NAV_SLUGS.academics,
    ],
    principal: [NAV_SLUGS.dashboard, NAV_SLUGS.students, NAV_SLUGS.academics, NAV_SLUGS.audit],
    vice_principal: [NAV_SLUGS.dashboard, NAV_SLUGS.students, NAV_SLUGS.academics, NAV_SLUGS.audit],
    academic_coordinator: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.academics,
      NAV_SLUGS.standards,
      NAV_SLUGS.timetable,
    ],
    admin_clerk: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.enquiries,
      NAV_SLUGS.students,
      NAV_SLUGS.applications,
    ],
    accountant: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.subscriptions,
      NAV_SLUGS.invoices,
      NAV_SLUGS.payments,
    ],
    class_teacher: [NAV_SLUGS.dashboard, NAV_SLUGS.timetable, NAV_SLUGS.students, NAV_SLUGS.groups],
    subject_teacher: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.timetable,
      NAV_SLUGS.students,
      NAV_SLUGS.groups,
    ],
    activity_teacher: [
      NAV_SLUGS.dashboard,
      NAV_SLUGS.groups,
      NAV_SLUGS.students,
      NAV_SLUGS.timetable,
    ],
  });
