import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';

/**
 * Configurable certificate templates — one per certificate type per institute.
 *
 * HTML/Handlebars templates rendered with student/staff data at issuance time.
 * approval_chain JSONB defines the sign-off workflow (e.g., class teacher → principal).
 *
 * No soft delete (tenantPoliciesSimple). Three-tier RLS enforced.
 */
export const certificateTemplates = pgTable(
  'certificate_templates',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),

    /**
     * Certificate type:
     * - `transfer_certificate`: formal TC issued when student leaves (CBSE 20-field format)
     * - `character_certificate`: attests student's conduct and character
     * - `bonafide_certificate`: proves student is currently enrolled at this institute
     * - `school_leaving_certificate`: Haryana SLC (equivalent of TC for state board)
     * - `study_certificate`: confirms period of study (without transfer)
     * - `dob_certificate`: school record attestation of date of birth
     * - `no_dues_certificate`: confirms all fees/library/lab dues are cleared
     * - `railway_concession`: concession form for student rail travel (Indian Railways)
     * - `attendance_certificate`: attests attendance percentage for a period
     * - `conduct_certificate`: formal conduct/behaviour attestation
     * - `sports_certificate`: participation/achievement in sports events
     * - `merit_certificate`: academic merit/topper certificate
     * - `provisional_certificate`: temporary certificate pending final issuance
     * - `custom`: institute-defined certificate type not covered above
     */
    type: varchar('type', { length: 30 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    /** HTML/Handlebars template for PDF generation — rendered with student/staff data */
    templateContent: text('template_content'),
    /** JSON Schema defining the fields required to populate this certificate */
    fieldsSchema: jsonb('fields_schema').notNull(),
    /**
     * Approval workflow chain — array of role-based sign-off steps:
     * `[{ role: 'class_teacher' }, { role: 'principal' }]`
     */
    approvalChain: jsonb('approval_chain').$type<Array<{ role: string }>>().default([]),
    /** Whether this template is available for use */
    isActive: boolean('is_active').notNull().default(true),
    /** Board affiliation — 'cbse', 'bseh', 'rbse', or NULL for custom templates */
    boardType: varchar('board_type', { length: 20 }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_certificate_type',
      sql`${table.type} IN (
        'transfer_certificate', 'character_certificate', 'bonafide_certificate',
        'school_leaving_certificate', 'study_certificate', 'dob_certificate',
        'no_dues_certificate', 'railway_concession', 'attendance_certificate',
        'conduct_certificate', 'sports_certificate', 'merit_certificate',
        'provisional_certificate', 'custom'
      )`,
    ),

    ...tenantPoliciesSimple('certificate_templates'),
  ],
).enableRLS();
