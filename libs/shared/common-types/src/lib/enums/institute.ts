/**
 * Institute-domain enums — single source of truth.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum(...)` column types
 *   - `apps/api-gateway` → `registerEnumType(...)` + `@IsEnum(...)` + `@Field(() => ...)`
 *   - `apps/web` → Zod schemas, Select options, runtime comparisons
 */

// ─── InstituteStatus ─────────────────────────────────────────────────────────

export const INSTITUTE_STATUS_VALUES = [
  // Institute registration submitted; awaiting platform approval
  'PENDING_APPROVAL',
  // Approved; awaiting reseller onboarding/payment setup before going live
  'PENDING',
  // Fully operational — staff and students can log in
  'ACTIVE',
  // Voluntarily deactivated by reseller; no logins allowed
  'INACTIVE',
  // Suspended by platform (e.g. policy violation); no logins allowed
  'SUSPENDED',
  // Registration rejected by platform; terminal state
  'REJECTED',
] as const;

/** String-literal union derived from the tuple above. */
export type InstituteStatus = (typeof INSTITUTE_STATUS_VALUES)[number];

/**
 * Self-mapping const object — use for runtime comparisons, NestJS `registerEnumType`,
 * `@IsEnum(InstituteStatus)`, and Zod `z.enum(INSTITUTE_STATUS_VALUES)`.
 */
export const InstituteStatus = Object.fromEntries(INSTITUTE_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in InstituteStatus]: K;
};

// ─── InstituteType ────────────────────────────────────────────────────────────

export const INSTITUTE_TYPE_VALUES = [
  // Traditional school (pre-primary through senior secondary)
  'SCHOOL',
  // Private coaching/tutorial centre
  'COACHING',
  // Library or reading-room institution
  'LIBRARY',
] as const;

export type InstituteType = (typeof INSTITUTE_TYPE_VALUES)[number];

export const InstituteType = Object.fromEntries(INSTITUTE_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in InstituteType]: K;
};

// ─── StructureFramework ───────────────────────────────────────────────────────

export const STRUCTURE_FRAMEWORK_VALUES = [
  // National Education Policy 2020 — flexible multi-stage framework (5+3+3+4)
  'NEP',
  // Legacy 10+2 board structure
  'TRADITIONAL',
] as const;

export type StructureFramework = (typeof STRUCTURE_FRAMEWORK_VALUES)[number];

export const StructureFramework = Object.fromEntries(
  STRUCTURE_FRAMEWORK_VALUES.map((v) => [v, v]),
) as { readonly [K in StructureFramework]: K };

// ─── SetupStatus ──────────────────────────────────────────────────────────────

export const SETUP_STATUS_VALUES = [
  // Provisioning job queued; no resources created yet
  'PENDING',
  // Temporal workflow is running; resources being created
  'IN_PROGRESS',
  // All setup steps succeeded; institute is ready to use
  'COMPLETED',
  // One or more setup steps failed; manual intervention needed
  'FAILED',
] as const;

export type SetupStatus = (typeof SETUP_STATUS_VALUES)[number];

export const SetupStatus = Object.fromEntries(SETUP_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in SetupStatus]: K;
};

// ─── AttendanceType ───────────────────────────────────────────────────────────

export const ATTENDANCE_TYPE_VALUES = [
  // Single attendance record per student per day
  'DAILY',
  // Attendance recorded per lecture/period
  'LECTURE_WISE',
] as const;

export type AttendanceType = (typeof ATTENDANCE_TYPE_VALUES)[number];

export const AttendanceType = Object.fromEntries(ATTENDANCE_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in AttendanceType]: K;
};

// ─── AcademicYearStatus ───────────────────────────────────────────────────────

export const ACADEMIC_YEAR_STATUS_VALUES = [
  // Year created but not yet started; timetable and standards being configured
  'PLANNING',
  // Year is live — attendance, exams, and results are being recorded
  'ACTIVE',
  // Year is winding down; results being finalised before archival
  'COMPLETING',
  // Year closed; read-only historical record
  'ARCHIVED',
] as const;

export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUS_VALUES)[number];

export const AcademicYearStatus = Object.fromEntries(
  ACADEMIC_YEAR_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in AcademicYearStatus]: K };

// ─── IdentifierType (institute identifiers) ─────────────────────────────────

export const INSTITUTE_IDENTIFIER_TYPE_VALUES = [
  // Unified District Information System for Education Plus — unique 11-digit code assigned by MoE, India
  'UDISE_PLUS',
  // CBSE board affiliation number — proves the institute is affiliated with CBSE
  'CBSE_AFFILIATION',
  // CBSE-assigned institute code used for board exam registration and result processing
  'CBSE_SCHOOL_CODE',
  // Board of School Education Haryana affiliation number
  'BSEH_AFFILIATION',
  // Rajasthan Board of Secondary Education registration number
  'RBSE_REGISTRATION',
  // Society registration number under the Societies Registration Act — legal entity proof
  'SOCIETY_REGISTRATION',
  // State government recognition certificate number — mandatory for operating as an institute
  'STATE_RECOGNITION',
  // Shala Darpan ID — Rajasthan government's institute management portal identifier
  'SHALA_DARPAN_ID',
] as const;

export type InstituteIdentifierType = (typeof INSTITUTE_IDENTIFIER_TYPE_VALUES)[number];
export const InstituteIdentifierType = Object.fromEntries(
  INSTITUTE_IDENTIFIER_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in InstituteIdentifierType]: K };

// ─── BoardType ──────────────────────────────────────────────────────────────

export const BOARD_TYPE_VALUES = [
  // Central Board of Secondary Education — India's largest national board
  'CBSE',
  // Board of School Education Haryana — state board for Haryana
  'BSEH',
  // Rajasthan Board of Secondary Education — state board for Rajasthan
  'RBSE',
  // Indian Certificate of Secondary Education — private national board (CISCE)
  'ICSE',
] as const;

export type BoardType = (typeof BOARD_TYPE_VALUES)[number];
export const BoardType = Object.fromEntries(BOARD_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in BoardType]: K;
};

// ─── AffiliationStatus ──────────────────────────────────────────────────────

export const AFFILIATION_STATUS_VALUES = [
  // Temporary affiliation granted for a fixed term — institute must meet conditions to upgrade
  'PROVISIONAL',
  // Full permanent affiliation — institute meets all board requirements
  'REGULAR',
  // Current affiliation period expired and renewal application is under review by the board
  'EXTENSION_PENDING',
  // Board revoked the affiliation — institute can no longer conduct board exams
  'REVOKED',
] as const;

export type AffiliationStatus = (typeof AFFILIATION_STATUS_VALUES)[number];
export const AffiliationStatus = Object.fromEntries(
  AFFILIATION_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in AffiliationStatus]: K };

// ─── EducationLevel ─────────────────────────────────────────────────────────

export const EDUCATION_LEVEL_VALUES = [
  // Nursery, LKG, UKG — ages 3-6, play-based early childhood education
  'PRE_PRIMARY',
  // Classes 1-5 — foundational literacy and numeracy
  'PRIMARY',
  // Classes 6-8 — bridge between primary and secondary education
  'UPPER_PRIMARY',
  // Classes 9-10 — board exam preparation stage (SSC/Matric)
  'SECONDARY',
  // Classes 11-12 — stream-based specialization, board exams (HSC/Intermediate)
  'SENIOR_SECONDARY',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVEL_VALUES)[number];
export const EducationLevel = Object.fromEntries(EDUCATION_LEVEL_VALUES.map((v) => [v, v])) as {
  readonly [K in EducationLevel]: K;
};

// ─── NepStage ───────────────────────────────────────────────────────────────

export const NEP_STAGE_VALUES = [
  // Ages 3-8 (classes pre-primary to 2) — play-based, activity-based learning per NEP 2020
  'FOUNDATIONAL',
  // Ages 8-11 (classes 3-5) — gradual transition to formal classroom learning
  'PREPARATORY',
  // Ages 11-14 (classes 6-8) — subject-oriented teaching with experiential learning
  'MIDDLE',
  // Ages 14-18 (classes 9-12) — multidisciplinary, flexible subject choice, board exams
  'SECONDARY',
] as const;

export type NepStage = (typeof NEP_STAGE_VALUES)[number];
export const NepStage = Object.fromEntries(NEP_STAGE_VALUES.map((v) => [v, v])) as {
  readonly [K in NepStage]: K;
};

// ─── StreamType ─────────────────────────────────────────────────────────────

export const STREAM_TYPE_VALUES = [
  // Science stream — PCM/PCB subjects, typically for engineering/medical aspirants
  'SCIENCE',
  // Commerce stream — accountancy, business studies, economics
  'COMMERCE',
  // Arts/Humanities stream — history, political science, sociology, languages
  'ARTS',
] as const;

export type StreamType = (typeof STREAM_TYPE_VALUES)[number];
export const StreamType = Object.fromEntries(STREAM_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in StreamType]: K;
};

// ─── GenderRestriction ──────────────────────────────────────────────────────

export const GENDER_RESTRICTION_VALUES = [
  // Co-educational — admits all genders, no restriction on enrollment
  'CO_ED',
  // Boys-only institute — enrollment restricted to male students
  'BOYS_ONLY',
  // Girls-only institute — enrollment restricted to female students
  'GIRLS_ONLY',
] as const;

export type GenderRestriction = (typeof GENDER_RESTRICTION_VALUES)[number];
export const GenderRestriction = Object.fromEntries(
  GENDER_RESTRICTION_VALUES.map((v) => [v, v]),
) as { readonly [K in GenderRestriction]: K };

// ─── BatchStatus ────────────────────────────────────────────────────────────

export const BATCH_STATUS_VALUES = [
  // Batch is scheduled for a future start date — enrollment open, classes not yet started
  'UPCOMING',
  // Batch is currently running — lectures, attendance, and assessments are active
  'ACTIVE',
  // Batch has finished its term — read-only, no new attendance or assessments
  'COMPLETED',
] as const;

export type BatchStatus = (typeof BATCH_STATUS_VALUES)[number];
export const BatchStatus = Object.fromEntries(BATCH_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in BatchStatus]: K;
};

// ─── SubjectType ────────────────────────────────────────────────────────────

export const SUBJECT_TYPE_VALUES = [
  // Core academic subject — board-mandated, included in formal exams (Math, Science, SST)
  'ACADEMIC',
  // Language subject — Hindi, English, Sanskrit, regional languages per board requirements
  'LANGUAGE',
  // Skill-based subject — vocational or life-skill courses (IT, AI, financial literacy)
  'SKILL',
  // Extracurricular activity — sports, music, art — typically not graded on board exams
  'EXTRACURRICULAR',
  // Internal assessment subject — evaluated only by the institute, not by the board
  'INTERNAL_ASSESSMENT',
] as const;

export type SubjectType = (typeof SUBJECT_TYPE_VALUES)[number];
export const SubjectType = Object.fromEntries(SUBJECT_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in SubjectType]: K;
};
