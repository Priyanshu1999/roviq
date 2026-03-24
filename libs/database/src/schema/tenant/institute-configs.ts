import { sql } from 'drizzle-orm';
import { foreignKey, jsonb, pgTable, time, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { attendanceType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

// ── JSONB type definitions ─────────────────────────────

export type ShiftConfig = {
  name: string;
  /** ISO time format: HH:MM (e.g., "07:30") */
  start: string;
  /** ISO time format: HH:MM (e.g., "13:00") */
  end: string;
};

export type TermConfig = {
  label: string;
  /** ISO date format: YYYY-MM-DD */
  startDate: string;
  /** ISO date format: YYYY-MM-DD */
  endDate: string;
};

export type SectionStrengthNorms = {
  /** Ideal number of students per section (e.g., 40 for CBSE) */
  optimal: number;
  /** Absolute maximum students allowed per section (e.g., 45 for CBSE through 2025-26) */
  hardMax: number;
  /** Whether the institute can request exemptions to exceed hardMax */
  exemptionAllowed: boolean;
};

export type AdmissionNumberConfig = {
  /** Template with `{prefix}`, `{year}`, `{value:04d}` placeholders */
  format: string;
  /** `'YYYY'` or `'YY-YY'` for the year portion */
  year_format: string;
  /** Map from standard numeric_order to prefix string (e.g., `{ "-3": "N-", "-2": "L-" }`) */
  prefixes: Record<string, string>;
  /** From this numeric_order onwards, no prefix is used */
  no_prefix_from_class: number;
};

// ── Table definition ───────────────────────────────────

export const instituteConfigs = pgTable(
  'institute_configs',
  {
    id: uuid().defaultRandom().primaryKey(),
    attendanceType: attendanceType('attendance_type').default('DAILY').notNull(),
    openingTime: time('opening_time'),
    closingTime: time('closing_time'),
    shifts: jsonb().$type<ShiftConfig[]>().default([]),
    notificationPreferences: jsonb('notification_preferences')
      .$type<Record<string, unknown>>()
      .default({}),
    payrollConfig: jsonb('payroll_config').$type<Record<string, unknown>>().default({}),
    gradingSystem: jsonb('grading_system').$type<Record<string, unknown>>().default({}),
    termStructure: jsonb('term_structure').$type<TermConfig[]>().default([]),
    /** CBSE/board-mandated section size constraints — optimal, hard max, and exemption rules */
    sectionStrengthNorms: jsonb('section_strength_norms')
      .$type<SectionStrengthNorms>()
      .default({ optimal: 40, hardMax: 45, exemptionAllowed: true }),
    /**
     * Controls how admission numbers are auto-generated per institute.
     *
     * - `format`: template with `{prefix}`, `{year}`, `{value:04d}` placeholders
     * - `year_format`: `'YYYY'` or `'YY-YY'` for the year portion
     * - `prefixes`: map from numeric_order (standard) to prefix string
     *   (-3=Nursery→"N-", -2=LKG→"L-", -1=UKG→"U-", 1=Class 1→"A-")
     * - `no_prefix_from_class`: from this numeric_order onwards, no prefix is used
     */
    admissionNumberConfig: jsonb('admission_number_config')
      .$type<AdmissionNumberConfig>()
      .default({
        format: '{prefix}{year}/{value:04d}',
        year_format: 'YYYY',
        prefixes: { '-3': 'N-', '-2': 'L-', '-1': 'U-', '1': 'A-' },
        no_prefix_from_class: 2,
      }),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    uniqueIndex('institute_configs_tenant_id_key')
      .on(table.tenantId)
      .where(sql`${table.deletedAt} IS NULL`),
    ...tenantPolicies('institute_configs'),
  ],
);
