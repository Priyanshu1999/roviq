import { EnquirySource, EnquiryStatus, GuardianRelationship } from '@roviq/common-types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { enquirySource, enquiryStatus, guardianRelationship } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { academicYears } from '../tenant/academic-years';
import { institutes } from '../tenant/institutes';

/**
 * Pre-admission enquiry — tracks potential students before formal application.
 *
 * Enquiries can be converted to admission_applications once the parent
 * decides to apply. Full-text search GIN index on student_name + parent_name
 * for quick lookup by front desk staff.
 *
 * Three-tier RLS enforced.
 */
export const enquiries = pgTable(
  'enquiries',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),

    // ── Student info (pre-admission, may not have a user yet) ──
    studentName: varchar('student_name', { length: 200 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    /** Biological gender — same values as user_profiles.gender */
    gender: varchar('gender', { length: 10 }),
    /** Requested class for admission — e.g., 'Nursery', 'LKG', 'Class 5' */
    classRequested: varchar('class_requested', { length: 20 }).notNull(),
    academicYearId: uuid('academic_year_id').references(() => academicYears.id),

    // ── Parent info ─────────────────────────────────────
    parentName: varchar('parent_name', { length: 200 }).notNull(),
    parentPhone: varchar('parent_phone', { length: 15 }).notNull(),
    parentEmail: varchar('parent_email', { length: 320 }),
    /** Relationship of the enquiring parent to the student */
    parentRelation: guardianRelationship('parent_relation').default(GuardianRelationship.FATHER),

    // ── Enquiry metadata ────────────────────────────────
    /**
     * How the enquiry reached the institute:
     * - `walk_in`: parent visited the institute in person
     * - `phone`: telephonic enquiry
     * - `website`: submitted via the institute's website form
     * - `social_media`: enquiry via Facebook, Instagram, etc.
     * - `referral`: referred by an existing parent, teacher, or contact
     * - `newspaper_ad`: response to newspaper advertisement
     * - `hoarding`: response to outdoor hoarding/banner
     * - `school_event`: parent attended an open day, exhibition, or fair
     * - `alumni`: referred by an alumnus of the institute
     * - `google`: found via Google Search or Google Maps
     * - `whatsapp`: enquiry received on WhatsApp
     * - `other`: any source not covered above
     */
    source: enquirySource('source').notNull().default(EnquirySource.WALK_IN),
    /** Name of the person who referred this enquiry (for referral source tracking) */
    referredBy: varchar('referred_by', { length: 200 }),
    /** Counsellor or front desk staff assigned to follow up on this enquiry */
    assignedTo: uuid('assigned_to').references(() => users.id),
    previousSchool: varchar('previous_school', { length: 255 }),
    previousBoard: varchar('previous_board', { length: 50 }),
    /** Whether the child has a sibling already studying at this institute */
    siblingInSchool: boolean('sibling_in_school').default(false),
    /** Admission number of the sibling (for verification and fee concessions) */
    siblingAdmissionNo: varchar('sibling_admission_no', { length: 30 }),
    /** Any special needs or disabilities noted during enquiry */
    specialNeeds: text('special_needs'),
    /** Free-form notes by front desk staff */
    notes: text('notes'),

    // ── Status ──────────────────────────────────────────
    /**
     * Enquiry lifecycle state:
     * - `new`: just received, not yet contacted
     * - `contacted`: initial contact made with parent
     * - `campus_visit_scheduled`: campus tour/visit date set
     * - `campus_visited`: parent has visited the campus
     * - `application_issued`: admission form given to parent
     * - `application_submitted`: parent has returned the filled form
     * - `test_scheduled`: entrance test date set
     * - `offer_made`: seat offered to the student
     * - `fee_paid`: admission fee received
     * - `enrolled`: student formally enrolled (terminal success state)
     * - `lost`: parent chose another institute or stopped responding
     * - `dropped`: institute decided not to pursue this enquiry
     */
    status: enquiryStatus('status').notNull().default(EnquiryStatus.NEW),
    /** Next scheduled follow-up date for this enquiry */
    followUpDate: date('follow_up_date'),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),

    // ── Conversion ──────────────────────────────────────
    /** Set when this enquiry is converted to a formal admission_application */
    convertedToApplicationId: uuid('converted_to_application_id'),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    /** Status + follow-up date lookup for CRM dashboard views */
    index('idx_enquiries_status')
      .on(table.tenantId, table.status, table.followUpDate)
      .where(sql`${table.deletedAt} IS NULL`),
    /** Full-text search GIN index on student_name + parent_name for front desk lookup */
    index('idx_enquiries_search').using(
      'gin',
      sql`to_tsvector('simple', coalesce(student_name, '') || ' ' || coalesce(parent_name, ''))`,
    ),

    ...tenantPolicies('enquiries'),
  ],
).enableRLS();
