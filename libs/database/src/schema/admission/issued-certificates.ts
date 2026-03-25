import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { staffProfiles } from '../user-profiles/staff-profiles';
import { studentProfiles } from '../user-profiles/student-profiles';
import { certificateTemplates } from './certificate-templates';

/**
 * Issued certificates — one row per certificate issued to a student or staff member.
 *
 * Can reference either student_profile_id OR staff_profile_id (not both required).
 * serial_number is unique per tenant. certificate_data JSONB stores the populated
 * template fields at issuance time.
 *
 * Three-tier RLS enforced.
 */
export const issuedCertificates = pgTable(
  'issued_certificates',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => certificateTemplates.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    /** Student receiving the certificate — NULL if issued to staff */
    studentProfileId: uuid('student_profile_id').references(() => studentProfiles.id),
    /** Staff member receiving the certificate — NULL if issued to student */
    staffProfileId: uuid('staff_profile_id').references(() => staffProfiles.id),
    /** Certificate serial number — unique per tenant (e.g., 'CERT/2025-26/BON/001') */
    serialNumber: varchar('serial_number', { length: 50 }).notNull(),

    // ── Status ──────────────────────────────────────────
    /**
     * Certificate lifecycle state:
     * - `draft`: certificate created but not yet submitted for approval
     * - `pending_approval`: submitted and awaiting approval chain sign-off
     * - `approved`: all approvers have signed off
     * - `issued`: certificate issued to the recipient
     * - `cancelled`: certificate voided after issuance (e.g., error found)
     */
    status: varchar('status', { length: 20 }).notNull().default('draft'),

    /** Populated template fields frozen at issuance time */
    certificateData: jsonb('certificate_data').notNull(),
    pdfUrl: text('pdf_url'),
    issuedDate: date('issued_date'),
    issuedBy: uuid('issued_by').references(() => users.id),
    /** Purpose for which the certificate was requested */
    purpose: varchar('purpose', { length: 255 }),
    /** Expiry date — relevant for provisional or time-limited certificates */
    validUntil: date('valid_until'),

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
      'chk_certificate_status',
      sql`${table.status} IN ('draft', 'pending_approval', 'approved', 'issued', 'cancelled')`,
    ),

    /** Certificate serial number unique per tenant */
    uniqueIndex('uq_certificate_serial').on(table.tenantId, table.serialNumber),
    index('idx_issued_certificates_student').on(table.studentProfileId),
    index('idx_issued_certificates_staff').on(table.staffProfileId),
    index('idx_issued_certificates_tenant_status')
      .on(table.tenantId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('issued_certificates'),
  ],
).enableRLS();
