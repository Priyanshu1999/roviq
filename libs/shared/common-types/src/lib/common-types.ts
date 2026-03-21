// biome-ignore-all lint/suspicious/noTemplateCurlyInString: '${user.id}' strings are CASL condition placeholders, not JS templates
import type { MongoAbility, RawRuleOf } from '@casl/ability';

// CASL Actions
export const AppAction = {
  Manage: 'manage',
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
} as const;

export type AppAction = (typeof AppAction)[keyof typeof AppAction];

// CASL Subjects — must match Drizzle table/entity names
export const AppSubject = {
  All: 'all',
  AcademicYear: 'AcademicYear',
  Institute: 'Institute',
  User: 'User',
  Role: 'Role',
  Student: 'Student',
  Section: 'Section',
  Standard: 'Standard',
  Subject: 'Subject',
  Timetable: 'Timetable',
  Attendance: 'Attendance',
  AuditLog: 'AuditLog',
  SubscriptionPlan: 'SubscriptionPlan',
  Subscription: 'Subscription',
  Invoice: 'Invoice',
  PaymentGatewayConfig: 'PaymentGatewayConfig',
  InstituteGroup: 'InstituteGroup',
} as const;

export type AppSubject = (typeof AppSubject)[keyof typeof AppSubject];

// The ability type used across backend and frontend
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

// Raw rule shape stored in DB and sent to frontend
export type AbilityRule = RawRuleOf<AppAbility>;

// Default role names
export const DefaultRoles = {
  InstituteAdmin: 'institute_admin',
  Teacher: 'teacher',
  Student: 'student',
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
export interface FeatureLimits {
  [key: string]: number | undefined;
  maxUsers?: number;
  maxSections?: number;
  maxStorageGb?: number;
}

export const DEFAULT_ROLE_ABILITIES: Record<DefaultRole, AbilityRule[]> = {
  institute_admin: [{ action: 'manage', subject: 'all' }],
  teacher: [
    { action: 'read', subject: 'Student' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Timetable' },
    { action: 'create', subject: 'Attendance' },
    { action: 'read', subject: 'Attendance' },
    { action: 'update', subject: 'Attendance' },
  ],
  student: [
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Attendance', conditions: { studentId: '${user.id}' } },
  ],
  parent: [
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Attendance' },
    { action: 'read', subject: 'Student' },
  ],
};
