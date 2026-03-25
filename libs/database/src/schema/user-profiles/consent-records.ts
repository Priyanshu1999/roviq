import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  inet,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { guardianProfiles } from './guardian-profiles';
import { privacyNotices } from './privacy-notices';
import { studentProfiles } from './student-profiles';

/**
 * DPDP Act 2023 verifiable parental consent tracking — APPEND-ONLY.
 *
 * Each consent decision (grant or withdrawal) creates a NEW row.
 * Existing rows are NEVER updated or deleted — this is a legal audit trail.
 * roviq_app gets SELECT + INSERT only (no UPDATE, no DELETE).
 *
 * Consent withdrawal creates a new row with `is_granted=false` + `withdrawn_at`.
 * The latest row per (guardian, student, purpose) determines current consent state.
 *
 * Three-tier RLS with custom append-only policies for roviq_app.
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    guardianProfileId: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardianProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Data processing purpose — each requires separate, specific consent (DPDP Section 6):
     * - `academic_data_processing`: grades, attendance, enrollment (Fourth Schedule exempt)
     * - `photo_video_marketing`: website, social media, brochures (requires explicit consent)
     * - `whatsapp_communication`: WhatsApp messages to parent
     * - `sms_communication`: SMS alerts to parent
     * - `aadhaar_collection`: collecting and storing Aadhaar number (sensitive data)
     * - `biometric_collection`: fingerprint/face recognition (highest sensitivity)
     * - `third_party_edtech`: sharing data with EdTech tools (cross-entity sharing)
     * - `board_exam_registration`: sharing with CBSE/BSEH/RBSE (regulatory compliance)
     * - `transport_tracking`: GPS tracking during school commute (child safety)
     * - `health_data_processing`: medical records and health data
     * - `cctv_monitoring`: campus CCTV surveillance
     */
    purpose: varchar('purpose', { length: 50 }).notNull(),

    /** true = consent granted, false = consent withdrawn */
    isGranted: boolean('is_granted').notNull(),
    /** Timestamp when consent was granted (NULL for withdrawal rows) */
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    /** Timestamp when consent was withdrawn (NULL for grant rows) */
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),

    /**
     * How the guardian's identity was verified for this consent action:
     * - `digilocker_token`: guardian authenticated via DigiLocker
     * - `aadhaar_otp`: verified via UIDAI Aadhaar OTP
     * - `in_person_id_check`: school admin verified physical ID (Aadhaar/PAN/Voter ID)
     * - `signed_form_uploaded`: scanned physical consent form uploaded
     * - `school_erp_verified_account`: guardian has verified phone via OTP in the system
     */
    verificationMethod: varchar('verification_method', { length: 30 }),
    /** DigiLocker token ID, Aadhaar OTP transaction ID, etc. */
    verificationReference: varchar('verification_reference', { length: 100 }),
    /** IP address of the device used for consent action */
    ipAddress: inet('ip_address'),
    /** Browser/app user agent string for audit trail */
    userAgent: text('user_agent'),
    /** Privacy notice version that was displayed when consent was given */
    privacyNoticeId: uuid('privacy_notice_id').references(() => privacyNotices.id),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_consent_purpose',
      sql`${table.purpose} IN (
        'academic_data_processing', 'photo_video_marketing', 'whatsapp_communication',
        'sms_communication', 'aadhaar_collection', 'biometric_collection',
        'third_party_edtech', 'board_exam_registration', 'transport_tracking',
        'health_data_processing', 'cctv_monitoring'
      )`,
    ),
    check(
      'chk_verification_method',
      sql`${table.verificationMethod} IS NULL OR ${table.verificationMethod} IN (
        'digilocker_token', 'aadhaar_otp', 'in_person_id_check',
        'signed_form_uploaded', 'school_erp_verified_account'
      )`,
    ),

    index('idx_consent_guardian').on(table.guardianProfileId, table.purpose),
    index('idx_consent_student').on(table.studentProfileId, table.purpose),

    // ── APPEND-ONLY RLS: roviq_app can SELECT + INSERT but NOT UPDATE/DELETE ──
    pgPolicy('consent_records_app_select', {
      for: 'select',
      to: roviqApp,
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy('consent_records_app_insert', {
      for: 'insert',
      to: roviqApp,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    /** BLOCKED: roviq_app cannot UPDATE consent records (append-only for DPDP compliance) */
    pgPolicy('consent_records_app_update', {
      for: 'update',
      to: roviqApp,
      using: sql`false`,
    }),
    /** BLOCKED: roviq_app cannot DELETE consent records (append-only for DPDP compliance) */
    pgPolicy('consent_records_app_delete', {
      for: 'delete',
      to: roviqApp,
      using: sql`false`,
    }),
    pgPolicy('consent_records_reseller_read', {
      for: 'select',
      to: roviqReseller,
      using: sql`tenant_id IN (
        SELECT id FROM institutes
        WHERE reseller_id = current_setting('app.current_reseller_id', true)::uuid
      )`,
    }),
    pgPolicy('consent_records_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
