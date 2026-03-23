// biome-ignore-all lint/suspicious/noTemplateCurlyInString: '${user.id}' strings are CASL condition placeholders, not JS templates
import type { MongoAbility, RawRuleOf } from '@casl/ability';

// CASL Actions
export const AppAction = {
  /** Superuser action — implies all other actions; granted only to institute admins and platform admins */
  Manage: 'manage',
  /** Create a new resource (e.g. enroll a student, add a section). Checked before INSERT operations */
  Create: 'create',
  /** View/list a resource. The most common action; almost every role has Read on some subjects */
  Read: 'read',
  /** Modify an existing resource (e.g. mark attendance, edit timetable). Checked before UPDATE operations */
  Update: 'update',
  /** Permanently remove or soft-delete a resource. Typically restricted to admin roles */
  Delete: 'delete',
  /** Allows a platform admin to act as another user within an institute for debugging/support purposes */
  Impersonate: 'impersonate',
} as const;

export type AppAction = (typeof AppAction)[keyof typeof AppAction];

// CASL Subjects — must match Drizzle table/entity names
export const AppSubject = {
  /** Wildcard subject — when paired with Manage, grants full access to every resource */
  All: 'all',
  /** Academic year / session (e.g. 2025-26). Controls term dates, fee cycles, and promotions */
  AcademicYear: 'AcademicYear',
  /** The institute (tenant) itself — settings, branding, onboarding status */
  Institute: 'Institute',
  /** Any user account (staff, teacher, parent). Distinct from Student, which is an enrollment record */
  User: 'User',
  /** Custom or default role within an institute — controls which abilities a membership carries */
  Role: 'Role',
  /** Student enrollment record linked to a section and academic year */
  Student: 'Student',
  /** A class section (e.g. "10-A"). Students and timetables are scoped to sections */
  Section: 'Section',
  /** A grade/class level (e.g. "Class 10"). Sections belong to a standard */
  Standard: 'Standard',
  /** An academic subject (e.g. "Mathematics"). Linked to timetable slots and teachers */
  Subject: 'Subject',
  /** Weekly timetable grid — maps time slots to subjects, teachers, and sections */
  Timetable: 'Timetable',
  /** Daily attendance records for students. Teachers create/update; students can only read their own */
  Attendance: 'Attendance',
  /** Immutable log of user actions for compliance and debugging. Read-only for all roles */
  AuditLog: 'AuditLog',
  /** Platform-level pricing plan that institutes subscribe to (e.g. Starter, Pro) */
  SubscriptionPlan: 'SubscriptionPlan',
  /** An institute's active subscription to a plan — tracks billing interval, status, and renewal */
  Subscription: 'Subscription',
  /** A billing invoice generated for a subscription period. Tracks payment status and due dates */
  Invoice: 'Invoice',
  /** Razorpay or Cashfree gateway credentials configured for an institute or the platform */
  PaymentGatewayConfig: 'PaymentGatewayConfig',
  /** A logical group of institutes managed together (e.g. a franchise or trust with multiple branches) */
  InstituteGroup: 'InstituteGroup',
} as const;

export type AppSubject = (typeof AppSubject)[keyof typeof AppSubject];

// The ability type used across backend and frontend
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

// Raw rule shape stored in DB and sent to frontend
export type AbilityRule = RawRuleOf<AppAbility>;

// Default role names
export const DefaultRoles = {
  /** Full control over the institute — manages users, roles, billing, and settings. Auto-assigned to the institute creator */
  InstituteAdmin: 'institute_admin',
  /** Staff member who teaches subjects, takes attendance, and views student/section data */
  Teacher: 'teacher',
  /** Enrolled learner — can view own attendance, timetable, and subjects. Cannot see other students' data */
  Student: 'student',
  /** Guardian of one or more students — can view their children's attendance, timetable, and basic info */
  Parent: 'parent',
} as const;

export type DefaultRole = (typeof DefaultRoles)[keyof typeof DefaultRoles];

// Auth scopes — determines which RLS context and module group a request uses
export type AuthScope = 'platform' | 'reseller' | 'institute';

// Authenticated user shape attached by JWT strategy
export interface AuthUser {
  userId: string;
  scope: AuthScope;
  tenantId?: string; // present when scope = 'institute'
  resellerId?: string; // present when scope = 'reseller'
  membershipId: string;
  roleId: string;
  type: 'access';
  // Impersonation fields
  isImpersonated?: boolean;
  impersonatorId?: string;
  impersonationSessionId?: string;
}

// Billing feature limits (JSON scalar in GraphQL, used by both frontend and backend)
// Canonical source: @roviq/ee-billing-types FeatureLimits
export interface FeatureLimits {
  maxStudents: number | null;
  maxStaff: number | null;
  maxStorageMb: number | null;
  auditLogRetentionDays: number;
  features: string[];
}

export const DEFAULT_ROLE_ABILITIES: Record<DefaultRole, AbilityRule[]> = {
  // Full control — manages users, roles, billing, academic structure, and settings
  institute_admin: [{ action: 'manage', subject: 'all' }],
  // Teachers: read academic structure + manage attendance. No create/update on standards/sections/subjects
  teacher: [
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Student' },
    { action: 'read', subject: 'Timetable' },
    { action: 'create', subject: 'Attendance' },
    { action: 'read', subject: 'Attendance' },
    { action: 'update', subject: 'Attendance' },
  ],
  // Students: read own data only
  student: [
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Attendance', conditions: { studentId: '${user.id}' } },
  ],
  // Parents: read children's data
  parent: [
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Attendance' },
    { action: 'read', subject: 'Student' },
  ],
};
