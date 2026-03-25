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
  /** Update institute basic info (name, code, contact, address) — more restricted than full Update */
  UpdateInfo: 'update_info',
  /** Update institute visual branding (logo, colors, theme) */
  UpdateBranding: 'update_branding',
  /** Update institute operational config (attendance type, shifts, grading, strength norms) */
  UpdateConfig: 'update_config',
  /** Change an entity's lifecycle status (activate, suspend, deactivate) — distinct from field updates */
  UpdateStatus: 'update_status',
  /** Activate an academic year or entity — named domain mutation per entity-lifecycle.md */
  Activate: 'activate',
  /** Archive an academic year — transition to read-only state */
  Archive: 'archive',
  /** Assign a teacher to a section */
  AssignTeacher: 'assign_teacher',
  /** View aggregate statistics for an entity (dashboard metrics) */
  ViewStatistics: 'view_statistics',
  /** Restore a soft-deleted resource from trash — typically platform admin only */
  Restore: 'restore',
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
  /** A payment record created when a gateway processes a charge (immutable, append-only) */
  Payment: 'Payment',
  /** Razorpay or Cashfree gateway credentials configured for a reseller */
  PaymentGatewayConfig: 'PaymentGatewayConfig',
  /** Reseller billing dashboard — aggregate metrics, revenue, MRR */
  BillingDashboard: 'BillingDashboard',
  /** A logical group of institutes managed together (e.g. a franchise or trust with multiple branches) */
  InstituteGroup: 'InstituteGroup',
  /** DPDP Act 2023 parental consent record — append-only audit trail for data processing purposes */
  Consent: 'Consent',
  /** Automated service account for notifications, integrations, chatbots, and bulk operations */
  Bot: 'Bot',
  /** Pre-admission enquiry from a prospective parent/student */
  Enquiry: 'Enquiry',
  /** Formal admission application with form data and status lifecycle */
  Application: 'Application',
  /** Guardian/parent linked to one or more students */
  Guardian: 'Guardian',
  /** Dynamic group — rule-based, composite, or static membership */
  Group: 'Group',
  /** Staff member profile — teacher, admin, support staff */
  Staff: 'Staff',
  /** Confidential counselor session notes — restricted to counselor + admin */
  CounselorNotes: 'CounselorNotes',
  /** Student health/medical records — restricted to nurse + admin + counselor */
  HealthRecord: 'HealthRecord',
  /** Transfer Certificate — issue/approve for outgoing students */
  TC: 'TC',
  /** Extracurricular activity or time-bound event */
  Activity: 'Activity',
  /** Fee structure, transactions, and concessions */
  Fee: 'Fee',
  /** Examination scheduling, marks entry, and results */
  Exam: 'Exam',
  /** Student report card / progress report */
  ReportCard: 'ReportCard',
  /** System configuration and infrastructure settings */
  SystemConfig: 'SystemConfig',
  /** Sports team roster and competitions */
  SportsTeam: 'SportsTeam',
  /** Library book transactions */
  LibraryTransaction: 'LibraryTransaction',
  /** Bus transport routes and student assignments */
  BusRoute: 'BusRoute',
  /** Hostel room assignments */
  HostelRoom: 'HostelRoom',
  /** General certificate (bonafide, character, study, etc.) from template */
  Certificate: 'Certificate',
  /** Compliance data export — UDISE+ DCF, CBSE Registration, RTE, AWR reports */
  Export: 'Export',
} as const;

export type AppSubject = (typeof AppSubject)[keyof typeof AppSubject];

// The ability type used across backend and frontend
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

// Raw rule shape stored in DB and sent to frontend
export type AbilityRule = RawRuleOf<AppAbility>;

// Default role names — 22 institute roles (ROV-166)
export const DefaultRoles = {
  /** Full control over the institute — manages users, roles, billing, and settings */
  InstituteAdmin: 'institute_admin',
  /** Senior academic leader — manages students, staff, sections; approves TCs */
  Principal: 'principal',
  /** Same as principal minus TC approval */
  VicePrincipal: 'vice_principal',
  /** Manages academic structure — standards, subjects; reads students and staff */
  AcademicCoordinator: 'academic_coordinator',
  /** Front office — manages student CRUD, enquiries, applications; reads Aadhaar/income */
  AdminClerk: 'admin_clerk',
  /** Finance — reads students, manages fees, reads TC for dues clearance */
  Accountant: 'accountant',
  /** Manages own section's students, attendance, and guardian contact */
  ClassTeacher: 'class_teacher',
  /** @deprecated Use ClassTeacher. Kept for backward compatibility with existing code. */
  Teacher: 'class_teacher',
  /** Reads students in own subject sections, manages assessments */
  SubjectTeacher: 'subject_teacher',
  /** Reads students, manages activities */
  ActivityTeacher: 'activity_teacher',
  /** Reads students in own subject sections, reads timetable */
  LabAssistant: 'lab_assistant',
  /** Reads students, manages library transactions */
  Librarian: 'librarian',
  /** Reads student bus route fields, manages routes */
  TransportIncharge: 'transport_incharge',
  /** Reads student hostel fields, manages rooms */
  HostelWarden: 'hostel_warden',
  /** Manages confidential counselor notes — NOT visible to principal */
  Counselor: 'counselor',
  /** Reads students, manages sports teams */
  SportsCoach: 'sports_coach',
  /** Manages bots and system configuration */
  ITAdmin: 'it_admin',
  /** Front desk — manages enquiries, reads basic student info only */
  Receptionist: 'receptionist',
  /** Reads students, manages exams and report cards */
  ExamCoordinator: 'exam_coordinator',
  /** Reads student medical info, manages health records */
  Nurse: 'nurse',
  /** Reads student name + photo only */
  SupportStaff: 'support_staff',
  /** Enrolled learner — reads own data only */
  Student: 'student',
  /** Guardian — reads linked children, manages consent */
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

/** Entitlements when EE is disabled — everything unlimited */
export const UNLIMITED_ENTITLEMENTS: FeatureLimits = {
  maxStudents: null,
  maxStaff: null,
  maxStorageMb: null,
  auditLogRetentionDays: 1095,
  features: [],
};

/** Sensible defaults for plans without explicit entitlements */
export const DEFAULT_ENTITLEMENTS: FeatureLimits = {
  maxStudents: 500,
  maxStaff: 50,
  maxStorageMb: 5120,
  auditLogRetentionDays: 90,
  features: [],
};

/** OSS interface for reading subscription entitlements. EE provides the implementation. */
export interface SubscriptionReader {
  findActiveByTenant(tenantId: string): Promise<{ plan: { entitlements: FeatureLimits } } | null>;
}
export const SUBSCRIPTION_READER = Symbol('SUBSCRIPTION_READER');

/**
 * CASL ability definitions for 22 institute roles (ROV-166).
 *
 * Key field-level restrictions:
 * - CounselorNotes: ONLY counselor + institute_admin (NOT principal)
 * - Aadhaar/PAN: ONLY admin_clerk + principal (via fields property)
 * - Annual income: ONLY admin_clerk (RTE eligibility)
 * - Medical info: ONLY nurse + institute_admin + counselor
 * - class_teacher: section-scoped via $user.assignedSections condition
 * - student: own data only via $user.sub condition
 * - guardian: linked children only (handled in resolver, not CASL condition)
 */
export const DEFAULT_ROLE_ABILITIES: Record<DefaultRole, AbilityRule[]> = {
  // ── 1. institute_admin — full control ──────────────────
  institute_admin: [{ action: 'manage', subject: 'all' }],

  // ── 2. principal — manages students, staff, sections; approves TCs ──
  principal: [
    { action: 'manage', subject: 'Student' },
    { action: 'manage', subject: 'Staff' },
    { action: 'manage', subject: 'Section' },
    { action: 'manage', subject: 'Standard' },
    { action: 'manage', subject: 'Subject' },
    { action: 'manage', subject: 'TC' },
    { action: 'read', subject: 'AuditLog' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'Guardian' },
    { action: 'read', subject: 'Group' },
    // Principal can read Aadhaar/PAN (via fields)
    { action: 'read', subject: 'Student', fields: ['aadhaar', 'pan'] },
  ],

  // ── 3. vice_principal — same as principal minus TC approval ──
  vice_principal: [
    { action: 'manage', subject: 'Student' },
    { action: 'manage', subject: 'Staff' },
    { action: 'manage', subject: 'Section' },
    { action: 'manage', subject: 'Standard' },
    { action: 'manage', subject: 'Subject' },
    { action: 'read', subject: 'TC' },
    { action: 'read', subject: 'AuditLog' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'Guardian' },
    { action: 'read', subject: 'Group' },
  ],

  // ── 4. academic_coordinator ─────────────────────────────
  academic_coordinator: [
    { action: 'manage', subject: 'Standard' },
    { action: 'manage', subject: 'Subject' },
    { action: 'read', subject: 'Student' },
    { action: 'read', subject: 'Staff' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'Group' },
  ],

  // ── 5. admin_clerk — CRUD students, enquiries, applications; reads Aadhaar/income ──
  admin_clerk: [
    { action: 'manage', subject: 'Student' },
    { action: 'manage', subject: 'Enquiry' },
    { action: 'manage', subject: 'Application' },
    { action: 'read', subject: 'Staff' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Institute' },
    // Aadhaar + annual income access for RTE verification
    { action: 'read', subject: 'Student', fields: ['aadhaar', 'pan', 'annual_income'] },
  ],

  // ── 6. accountant ───────────────────────────────────────
  accountant: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'Fee' },
    { action: 'read', subject: 'TC' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
  ],

  // ── 7. class_teacher — section-scoped ───────────────────
  class_teacher: [
    {
      action: 'read',
      subject: 'Student',
      conditions: { sectionId: { $in: '$user.assignedSections' } },
    },
    {
      action: 'manage',
      subject: 'Attendance',
      conditions: { sectionId: { $in: '$user.assignedSections' } },
    },
    {
      action: 'read',
      subject: 'Guardian',
      conditions: { sectionId: { $in: '$user.assignedSections' } },
    },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Group' },
  ],

  // ── 8. subject_teacher ──────────────────────────────────
  subject_teacher: [
    {
      action: 'read',
      subject: 'Student',
      conditions: { sectionId: { $in: '$user.assignedSections' } },
    },
    { action: 'manage', subject: 'Exam' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'Timetable' },
  ],

  // ── 9. activity_teacher ─────────────────────────────────
  activity_teacher: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'Activity' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 10. lab_assistant ───────────────────────────────────
  lab_assistant: [
    {
      action: 'read',
      subject: 'Student',
      conditions: { sectionId: { $in: '$user.assignedSections' } },
    },
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 11. librarian ───────────────────────────────────────
  librarian: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'LibraryTransaction' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 12. transport_incharge ──────────────────────────────
  transport_incharge: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'BusRoute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 13. hostel_warden ───────────────────────────────────
  hostel_warden: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'HostelRoom' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 14. counselor — manages confidential notes (NOT visible to principal) ──
  counselor: [
    { action: 'manage', subject: 'CounselorNotes' },
    { action: 'read', subject: 'Student' },
    { action: 'read', subject: 'HealthRecord' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 15. sports_coach ────────────────────────────────────
  sports_coach: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'SportsTeam' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 16. it_admin ────────────────────────────────────────
  it_admin: [
    { action: 'manage', subject: 'Bot' },
    { action: 'read', subject: 'SystemConfig' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 17. receptionist — manages enquiries, reads basic student info ──
  receptionist: [
    { action: 'manage', subject: 'Enquiry' },
    {
      action: 'read',
      subject: 'Student',
      fields: ['id', 'firstName', 'lastName', 'admissionNumber', 'academicStatus'],
    },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 18. exam_coordinator ────────────────────────────────
  exam_coordinator: [
    { action: 'read', subject: 'Student' },
    { action: 'manage', subject: 'Exam' },
    { action: 'manage', subject: 'ReportCard' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 19. nurse — reads student medical info ──────────────
  nurse: [
    { action: 'read', subject: 'Student', fields: ['id', 'firstName', 'lastName', 'medicalInfo'] },
    { action: 'manage', subject: 'HealthRecord' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 20. support_staff — reads student name + photo only ──
  support_staff: [
    {
      action: 'read',
      subject: 'Student',
      fields: ['id', 'firstName', 'lastName', 'profileImageUrl'],
    },
    { action: 'read', subject: 'Institute' },
  ],

  // ── 21. student — reads own data only ───────────────────
  student: [
    { action: 'read', subject: 'Student', conditions: { userId: '$user.sub' } },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Timetable' },
    { action: 'read', subject: 'Attendance', conditions: { studentId: '${user.id}' } },
  ],

  // ── 22. parent (guardian) — reads linked children + manages consent ──
  parent: [
    { action: 'read', subject: 'Student' },
    { action: 'read', subject: 'Attendance' },
    { action: 'manage', subject: 'Consent' },
    { action: 'read', subject: 'Institute' },
    { action: 'read', subject: 'AcademicYear' },
    { action: 'read', subject: 'Standard' },
    { action: 'read', subject: 'Section' },
    { action: 'read', subject: 'Subject' },
    { action: 'read', subject: 'Timetable' },
  ],
};
