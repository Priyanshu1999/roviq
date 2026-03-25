import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { guardianProfiles } from './guardian-profiles';
import { studentProfiles } from './student-profiles';

/**
 * Junction table linking students to guardians — bidirectional querying.
 * Replaces the old `student_guardians` table dropped in ROV-149.
 *
 * Three-tier RLS enforced. Partial unique index ensures exactly
 * one primary contact per student at the database level.
 */
export const studentGuardianLinks = pgTable(
  'student_guardian_links',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    guardianProfileId: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardianProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Relationship of the guardian to the student:
     * - `father`: biological or adoptive father
     * - `mother`: biological or adoptive mother
     * - `legal_guardian`: court-appointed or legally designated guardian
     * - `grandparent_paternal`: father's parent — common caretaker in joint families
     * - `grandparent_maternal`: mother's parent — common caretaker in joint families
     * - `uncle`: paternal or maternal uncle acting as guardian
     * - `aunt`: paternal or maternal aunt acting as guardian
     * - `sibling`: elder sibling acting as guardian (e.g., orphaned students)
     * - `other`: any other authorised person (e.g., hostel warden, family friend)
     */
    relationship: varchar('relationship', { length: 30 }).notNull(),
    /** The designated primary contact for school communications and TC issuance */
    isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
    /** Listed as emergency contact — called in medical/safety situations */
    isEmergencyContact: boolean('is_emergency_contact').notNull().default(false),
    /** Authorised to pick up the student from school premises */
    canPickup: boolean('can_pickup').notNull().default(true),
    /** Whether the student resides with this guardian — affects address on records */
    livesWith: boolean('lives_with').notNull().default(true),

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
      'chk_relationship',
      sql`${table.relationship} IN (
        'father', 'mother', 'legal_guardian', 'grandparent_paternal',
        'grandparent_maternal', 'uncle', 'aunt', 'sibling', 'other'
      )`,
    ),

    /** One link per student-guardian pair per institute */
    uniqueIndex('uq_student_guardian').on(table.studentProfileId, table.guardianProfileId),
    /** Exactly one primary contact per student — enforced at DB level */
    uniqueIndex('idx_primary_contact')
      .on(table.studentProfileId)
      .where(sql`${table.isPrimaryContact} = true`),
    /** Find all students of a guardian (sibling discovery, parent dashboard) */
    index('idx_guardian_students').on(table.guardianProfileId),

    ...tenantPoliciesSimple('student_guardian_links'),
  ],
).enableRLS();
