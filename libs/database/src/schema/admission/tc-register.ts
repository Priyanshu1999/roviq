import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { academicYears } from '../tenant/academic-years';
import { institutes } from '../tenant/institutes';
import { studentProfiles } from '../user-profiles/student-profiles';

// ── JSONB type definitions ─────────────────────────────

/** Department clearance record within tc_register.clearances */
export type ClearanceRecord = {
  cleared: boolean;
  by?: string;
  at?: string;
  notes?: string;
};

/** Clearances JSONB: { accounts, library, lab, transport, hostel, ... } */
export type TcClearances = Record<string, ClearanceRecord>;

/**
 * Transfer Certificate register — tracks the full TC lifecycle from request
 * through clearance, generation, review, approval, and issuance.
 *
 * tc_data JSONB snapshots all 20+ CBSE fields at generation time so the TC
 * remains accurate even if the student record is later modified.
 *
 * Supports duplicate TC issuance via self-referencing FK (original_tc_id).
 * Three-tier RLS enforced.
 */
export const tcRegister = pgTable(
  'tc_register',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    /** TC serial number — e.g., 'TC/2025-26/001'. Unique per tenant. */
    tcSerialNumber: varchar('tc_serial_number', { length: 50 }).notNull(),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    // ── Status workflow ─────────────────────────────────
    /**
     * TC lifecycle state:
     * - `requested`: guardian/admin initiated TC request
     * - `clearance_pending`: awaiting department clearances (accounts, library, lab, transport)
     * - `clearance_complete`: all departments have cleared the student
     * - `generated`: TC document auto-generated from student record snapshot
     * - `review_pending`: awaiting class teacher / section head review
     * - `approved`: principal has approved the TC
     * - `issued`: TC physically/digitally handed to guardian
     * - `cancelled`: TC request cancelled before issuance
     * - `duplicate_requested`: request for a duplicate copy of an already-issued TC
     * - `duplicate_issued`: duplicate TC issued (with fee)
     */
    status: varchar('status', { length: 20 }).notNull().default('requested'),

    // ── TC data (snapshot at generation time) ───────────
    /**
     * All 20+ CBSE Transfer Certificate fields frozen at generation time:
     * name, parents, DOB, nationality, category, admission date, class,
     * subjects, result, dues status, attendance, conduct, NCC, reason for leaving, etc.
     */
    tcData: jsonb('tc_data').notNull().default({}),

    // ── Workflow tracking ────────────────────────────────
    requestedBy: uuid('requested_by').references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    /** Reason for TC request — shown on the TC document */
    reason: varchar('reason', { length: 200 }).notNull(),
    /**
     * Department clearances — each key is a department, value tracks cleared status:
     * `{ accounts: { cleared: true, by: 'uuid', at: 'timestamp' }, library: { cleared: false }, ... }`
     */
    clearances: jsonb('clearances').$type<TcClearances>().default({}),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    /** Must be Principal — enforced by CASL at application level */
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    /** Name of the person who physically collected the TC */
    issuedTo: varchar('issued_to', { length: 200 }),

    // ── Digital ─────────────────────────────────────────
    pdfUrl: text('pdf_url'),
    /** QR code URL for online TC verification — e.g., '{domain}/tc/verify/{serial}' */
    qrVerificationUrl: text('qr_verification_url'),
    /** Whether the TC has been counter-signed by DEO (required for inter-district transfers in Haryana) */
    isCounterSigned: boolean('is_counter_signed').default(false),
    counterSignedBy: varchar('counter_signed_by', { length: 200 }),

    // ── Duplicate TC ────────────────────────────────────
    /** Whether this is a duplicate copy of a previously issued TC */
    isDuplicate: boolean('is_duplicate').notNull().default(false),
    /** Self-referencing FK to the original TC — NULL if this is the original */
    originalTcId: uuid('original_tc_id'),
    duplicateReason: text('duplicate_reason'),
    /** Duplicate TC fee in paise (BIGINT to avoid decimal truncation) */
    duplicateFee: bigint('duplicate_fee', { mode: 'bigint' }),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    /** Self-referencing FK for duplicate TCs */
    foreignKey({
      columns: [table.originalTcId],
      foreignColumns: [table.id],
    }),

    check(
      'chk_tc_status',
      sql`${table.status} IN (
        'requested', 'clearance_pending', 'clearance_complete',
        'generated', 'review_pending', 'approved', 'issued',
        'cancelled', 'duplicate_requested', 'duplicate_issued'
      )`,
    ),

    /** TC serial number unique per tenant */
    uniqueIndex('uq_tc_serial').on(table.tenantId, table.tcSerialNumber),
    index('idx_tc_register_tenant_status')
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_tc_register_student').on(table.studentProfileId),

    ...tenantPolicies('tc_register'),
  ],
).enableRLS();
