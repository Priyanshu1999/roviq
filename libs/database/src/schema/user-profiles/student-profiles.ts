import { AcademicStatus, AdmissionType, SocialCategory } from '@roviq/common-types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import {
  academicStatus,
  admissionType,
  minorityType,
  socialCategory,
  studentStream,
} from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { memberships } from '../tenant/memberships';

// ── JSONB type definitions ─────────────────────────────

/** Medical information stored as JSONB on student_profiles */
export type MedicalInfo = {
  /** Known allergies (food, drug, environmental) */
  allergies?: string[];
  /** Chronic conditions (asthma, diabetes, epilepsy, etc.) */
  conditions?: string[];
  /** Current medications */
  medications?: string[];
  /** Emergency contact info (separate from guardian) */
  emergency_contact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
};

// ── Table definition ───────────────────────────────────

/**
 * Tenant-scoped student domain data — one row per membership (one student per institute).
 *
 * Three-tier RLS enforced:
 * - roviq_app: tenant-scoped CRUD
 * - roviq_reseller: read-only across their institutes
 * - roviq_admin: full access
 */
export const studentProfiles = pgTable(
  'student_profiles',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .unique()
      .references(() => memberships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    // ── Admission ───────────────────────────────────────
    /** Institute-assigned admission number — unique per tenant among non-deleted students */
    admissionNumber: varchar('admission_number', { length: 30 }).notNull(),
    /** Date of first admission to this institute */
    admissionDate: date('admission_date').notNull(),
    /** Class at time of first admission (e.g., 'Nursery', 'Class 5') */
    admissionClass: varchar('admission_class', { length: 20 }),
    /**
     * How the student was admitted:
     * - `new`: fresh admission to the institute
     * - `rte`: admitted under Right to Education Act reservation
     * - `lateral_entry`: mid-session admission from another institute
     * - `re_admission`: returning after withdrawal/dropout
     * - `transfer`: formal transfer from another institute with TC
     */
    admissionType: admissionType('admission_type').notNull().default(AdmissionType.NEW),

    // ── Academic status ─────────────────────────────────
    /**
     * Current lifecycle state of this student at this institute:
     * - `enrolled`: actively studying
     * - `promoted`: passed and promoted to next class
     * - `detained`: failed and retained in same class
     * - `graduated`: completed final year (Class 10/12)
     * - `transferred_out`: formally transferred to another institute (TC issued)
     * - `dropped_out`: left without formal transfer
     * - `withdrawn`: voluntarily withdrawn by guardian
     * - `suspended`: temporarily barred from attending
     * - `expelled`: permanently removed for disciplinary reasons
     * - `re_enrolled`: returned after dropout/withdrawal
     * - `passout`: completed coaching program (coaching-specific)
     */
    academicStatus: academicStatus('academic_status').notNull().default(AcademicStatus.ENROLLED),

    // ── Regulatory ──────────────────────────────────────
    /**
     * Social category for government reporting (UDISE+, RTE):
     * - `general`: no reservation category
     * - `sc`: Scheduled Caste
     * - `st`: Scheduled Tribe
     * - `obc`: Other Backward Classes
     * - `ews`: Economically Weaker Section
     */
    socialCategory: socialCategory('social_category').notNull().default(SocialCategory.GENERAL),
    /** Specific caste name (separate from category) — required on Transfer Certificate */
    caste: varchar('caste', { length: 100 }),
    /** Whether the student belongs to a religious/linguistic minority community */
    isMinority: boolean('is_minority').notNull().default(false),
    /**
     * Religious minority community (National Commission for Minorities Act).
     * NULL if is_minority = false.
     *
     * - `muslim`: Islam — largest minority community in India
     * - `christian`: Christianity — includes Catholic, Protestant, and other denominations
     * - `sikh`: Sikhism — recognized minority under NCM Act
     * - `buddhist`: Buddhism — recognized minority under NCM Act
     * - `parsi`: Zoroastrianism — smallest recognized minority community
     * - `jain`: Jainism — added to NCM list in 2014
     * - `other`: any other minority community not covered above
     */
    minorityType: minorityType('minority_type'),
    /** Whether the student's family is Below Poverty Line — affects fee concessions and RTE eligibility */
    isBpl: boolean('is_bpl').notNull().default(false),
    /** Whether the student is a Child With Special Needs (CWSN) — UDISE+ reporting field */
    isCwsn: boolean('is_cwsn').notNull().default(false),
    /** RPWD Act 2016 disability category (21 types). NULL if is_cwsn = false. */
    cwsnType: varchar('cwsn_type', { length: 60 }),
    /** Whether admitted under RTE Act Section 12(1)(c) — 25% reservation for EWS/DG */
    isRteAdmitted: boolean('is_rte_admitted').notNull().default(false),
    /** EWS/DG certificate number for RTE verification */
    rteCertificate: varchar('rte_certificate', { length: 50 }),

    // ── Previous school (for TC verification and lateral entry) ──
    previousSchoolName: varchar('previous_school_name', { length: 255 }),
    /** Board of previous school (CBSE, ICSE, state board name) */
    previousSchoolBoard: varchar('previous_school_board', { length: 50 }),
    /** 11-digit UDISE+ code of previous school — for government verification */
    previousSchoolUdise: char('previous_school_udise', { length: 11 }),
    /** Transfer Certificate number from previous school */
    incomingTcNumber: varchar('incoming_tc_number', { length: 50 }),
    incomingTcDate: date('incoming_tc_date'),

    // ── TC outgoing ─────────────────────────────────────
    /** Whether a Transfer Certificate has been issued for this student */
    tcIssued: boolean('tc_issued').notNull().default(false),
    tcNumber: varchar('tc_number', { length: 50 }),
    tcIssuedDate: date('tc_issued_date'),
    /** Reason for leaving (shown on TC) */
    tcReason: varchar('tc_reason', { length: 100 }),
    /** Date of leaving the institute */
    dateOfLeaving: date('date_of_leaving'),

    // ── Stream (Class 11-12) ────────────────────────────
    /**
     * Academic stream for senior secondary students:
     * - `science_pcm`: Physics + Chemistry + Mathematics
     * - `science_pcb`: Physics + Chemistry + Biology
     * - `commerce`: Accountancy + Business Studies + Economics
     * - `arts`: History + Political Science + Geography etc.
     * - `vocational`: skill-based subjects (IT, AI, etc.)
     */
    stream: studentStream('stream'),

    // ── Coaching-specific (NULL for schools) ────────────
    batchStartDate: date('batch_start_date'),
    batchEndDate: date('batch_end_date'),
    courseName: varchar('course_name', { length: 100 }),

    // ── Medical ─────────────────────────────────────────
    /** Medical information: allergies, conditions, medications, emergency contact */
    medicalInfo: jsonb('medical_info').$type<MedicalInfo>(),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    // ── CHECK constraints ──────────────────────────────
    // ── Indexes ────────────────────────────────────────
    /** Partial unique: admission number unique among non-deleted students per tenant */
    uniqueIndex('idx_student_admission_no_active')
      .on(table.tenantId, table.admissionNumber)
      .where(sql`${table.deletedAt} IS NULL`),
    /** Status lookup for filtered views (enrolled, transferred, etc.) */
    index('idx_student_profiles_tenant_status')
      .on(table.tenantId, table.academicStatus)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_student_profiles_membership').on(table.membershipId),
    /** Trigram index for typeahead search on admission number */
    index('idx_student_profiles_admission_trgm').using('gin', sql`admission_number gin_trgm_ops`),

    // ── RLS policies ───────────────────────────────────
    ...tenantPolicies('student_profiles'),
  ],
).enableRLS();
