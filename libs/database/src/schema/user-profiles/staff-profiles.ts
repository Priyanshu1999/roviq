import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { memberships } from '../tenant/memberships';

/**
 * Tenant-scoped staff domain data — one row per membership (one staff per institute).
 *
 * Three-tier RLS enforced. Includes UDISE+ teacher fields (social_category,
 * is_disabled, disability_type) required for DCF reporting.
 */
export const staffProfiles = pgTable(
  'staff_profiles',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .unique()
      .references(() => memberships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /** Institute-assigned staff/employee ID */
    employeeId: varchar('employee_id', { length: 30 }),
    /** Job title — e.g., 'PGT Physics', 'TGT Mathematics', 'PRT', 'Lab Assistant' */
    designation: varchar('designation', { length: 100 }),
    /** Department — e.g., 'Science', 'Commerce', 'Arts', 'Administration', 'Support' */
    department: varchar('department', { length: 50 }),
    dateOfJoining: date('date_of_joining'),
    dateOfLeaving: date('date_of_leaving'),
    leavingReason: varchar('leaving_reason', { length: 100 }),

    // ── Employment ──────────────────────────────────────
    /**
     * Employment type:
     * - `regular`: permanent full-time staff
     * - `contractual`: fixed-term contract
     * - `part_time`: part-time teacher/staff
     * - `guest`: guest lecturer
     * - `volunteer`: unpaid volunteer
     */
    employmentType: varchar('employment_type', { length: 20 }).default('regular'),
    /** Whether this staff member is assigned as class teacher for a section */
    isClassTeacher: boolean('is_class_teacher').notNull().default(false),

    // ── UDISE+ teacher fields ───────────────────────────
    /** Whether trained for Children With Special Needs instruction — UDISE+ DCF field */
    trainedForCwsn: boolean('trained_for_cwsn').notNull().default(false),
    /** Nature of appointment — 'permanent', 'temporary', 'adhoc', 'probation' */
    natureOfAppointment: varchar('nature_of_appointment', { length: 30 }),
    /**
     * Social category for UDISE+ teacher reporting — same enum as student_profiles:
     * - `general`, `sc`, `st`, `obc`, `ews`
     */
    socialCategory: varchar('social_category', { length: 10 }),
    /** Whether the staff member has a disability — UDISE+ DCF field */
    isDisabled: boolean('is_disabled').notNull().default(false),
    /** RPWD Act 2016 disability category (21 types). NULL if is_disabled = false. */
    disabilityType: varchar('disability_type', { length: 60 }),

    // ── Coaching-specific ───────────────────────────────
    /** Subject specialization — e.g., 'JEE Physics', 'NEET Biology' */
    specialization: varchar('specialization', { length: 100 }),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_employment_type',
      sql`${table.employmentType} IS NULL OR ${table.employmentType} IN (
        'regular', 'contractual', 'part_time', 'guest', 'volunteer'
      )`,
    ),
    check(
      'chk_staff_social_category',
      sql`${table.socialCategory} IS NULL OR ${table.socialCategory} IN (
        'general', 'sc', 'st', 'obc', 'ews'
      )`,
    ),

    index('idx_staff_profiles_tenant').on(table.tenantId).where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('staff_profiles'),
  ],
).enableRLS();
