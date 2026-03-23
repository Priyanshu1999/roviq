import { pgEnum } from 'drizzle-orm/pg-core';

// Domain-specific status enums — each entity owns its lifecycle
export const userStatus = pgEnum('UserStatus', [
  // User can log in and access all permitted features
  'ACTIVE',
  // Temporarily blocked by a platform admin — cannot log in, data preserved
  'SUSPENDED',
  // Auto-locked after too many failed login attempts — requires admin unlock
  'LOCKED',
]);
export const instituteStatus = pgEnum('InstituteStatus', [
  // Reseller-created institute awaiting platform admin review — no setup or logins until approved
  'PENDING_APPROVAL',
  // Approved by platform admin — Temporal setup workflow running, no logins yet
  'PENDING',
  // Fully operational — tenant database provisioned, setup complete, users can log in
  'ACTIVE',
  // Voluntarily deactivated by the institute or platform admin — data preserved, logins blocked
  'INACTIVE',
  // Forcibly blocked by platform admin (e.g., policy violation) — all access revoked, data preserved
  'SUSPENDED',
  // Platform admin denied the registration request — terminal state, institute cannot proceed
  'REJECTED',
]);
export const membershipStatus = pgEnum('MembershipStatus', [
  // User is an active member of the institute and can exercise their role's abilities
  'ACTIVE',
  // Membership temporarily frozen by institute admin — user cannot access this institute
  'SUSPENDED',
  // Membership permanently removed — user loses all access and abilities in this institute
  'REVOKED',
]);
export const roleStatus = pgEnum('RoleStatus', [
  // Role can be assigned to members and its abilities are enforced by CASL
  'ACTIVE',
  // Role is disabled — cannot be assigned to new members, existing holders lose its abilities
  'INACTIVE',
]);
// ── Institute domain enums ─────────────────────────────
export const instituteType = pgEnum('InstituteType', [
  // K-12 institute following a recognized board (CBSE, BSEH, etc.) with grades and sections
  'SCHOOL',
  // Tutoring/coaching center — flexible batches, no formal grade structure required
  'COACHING',
  // Library management institute — focuses on catalog, memberships, and lending workflows
  'LIBRARY',
]);

export const structureFramework = pgEnum('StructureFramework', [
  // National Education Policy 2020 — uses four stages (Foundational, Preparatory, Middle, Secondary)
  'NEP',
  // Traditional class-based structure — uses numbered classes (1-12) with board-defined divisions
  'TRADITIONAL',
]);

export const setupStatus = pgEnum('SetupStatus', [
  // Institute onboarding has not started yet — waiting for admin to begin setup wizard
  'PENDING',
  // Setup wizard is actively running — tenant DB provisioning, seed data, or config in progress
  'IN_PROGRESS',
  // All setup steps finished successfully — institute is ready for use
  'COMPLETED',
  // Setup encountered an unrecoverable error — requires platform admin intervention to retry
  'FAILED',
]);

export const identifierType = pgEnum('IdentifierType', [
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
]);

export const boardType = pgEnum('BoardType', [
  // Central Board of Secondary Education — India's largest national board
  'CBSE',
  // Board of School Education Haryana — state board for Haryana
  'BSEH',
  // Rajasthan Board of Secondary Education — state board for Rajasthan
  'RBSE',
  // Indian Certificate of Secondary Education — private national board (CISCE)
  'ICSE',
]);

export const affiliationStatus = pgEnum('AffiliationStatus', [
  // Temporary affiliation granted for a fixed term — institute must meet conditions to upgrade
  'PROVISIONAL',
  // Full permanent affiliation — institute meets all board requirements
  'REGULAR',
  // Current affiliation period expired and renewal application is under review by the board
  'EXTENSION_PENDING',
  // Board revoked the affiliation — institute can no longer conduct board exams
  'REVOKED',
]);

export const attendanceType = pgEnum('AttendanceType', [
  // Attendance tracked per individual lecture/period — common in coaching institutes
  'LECTURE_WISE',
  // Single attendance entry per day — typical for K-12 institutes
  'DAILY',
]);

export const academicYearStatus = pgEnum('AcademicYearStatus', [
  // New year being set up — standards/sections created, promotions pending. No operational activity
  'PLANNING',
  // Current operational year — only one per institute at any time. Attendance, fees, etc. active
  'ACTIVE',
  // End-of-year phase — final exams, result processing, promotions. Still active for data entry
  'COMPLETING',
  // Read-only historical year — archived and immutable except for compliance corrections by platform admin
  'ARCHIVED',
]);

// ── Academic structure enums ───────────────────────────
export const educationLevel = pgEnum('EducationLevel', [
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
]);

export const nepStage = pgEnum('NepStage', [
  // Ages 3-8 (classes pre-primary to 2) — play-based, activity-based learning per NEP 2020
  'FOUNDATIONAL',
  // Ages 8-11 (classes 3-5) — gradual transition to formal classroom learning
  'PREPARATORY',
  // Ages 11-14 (classes 6-8) — subject-oriented teaching with experiential learning
  'MIDDLE',
  // Ages 14-18 (classes 9-12) — multidisciplinary, flexible subject choice, board exams
  'SECONDARY',
]);

export const streamType = pgEnum('StreamType', [
  // Science stream — PCM/PCB subjects, typically for engineering/medical aspirants
  'SCIENCE',
  // Commerce stream — accountancy, business studies, economics
  'COMMERCE',
  // Arts/Humanities stream — history, political science, sociology, languages
  'ARTS',
]);

export const genderRestriction = pgEnum('GenderRestriction', [
  // Co-educational — admits all genders, no restriction on enrollment
  'CO_ED',
  // Boys-only institute — enrollment restricted to male students
  'BOYS_ONLY',
  // Girls-only institute — enrollment restricted to female students
  'GIRLS_ONLY',
]);

export const batchStatus = pgEnum('BatchStatus', [
  // Batch is scheduled for a future start date — enrollment open, classes not yet started
  'UPCOMING',
  // Batch is currently running — lectures, attendance, and assessments are active
  'ACTIVE',
  // Batch has finished its term — read-only, no new attendance or assessments
  'COMPLETED',
]);

export const groupType = pgEnum('GroupType', [
  // Charitable trust operating one or more institutes under a single trust deed
  'TRUST',
  // Registered society (Societies Registration Act) managing institutes collectively
  'SOCIETY',
  // Corporate chain — centrally managed institutes sharing branding and operations
  'CHAIN',
  // Franchise model — independently operated institutes licensed under a parent brand
  'FRANCHISE',
]);

export const resellerTier = pgEnum('resellerTier', [
  // Full control — reseller can manage institutes, billing, and configurations end-to-end
  'full_management',
  // Support-only access — reseller can assist institutes but cannot modify billing or config
  'support_management',
  // View-only access — reseller can see institute data and reports but cannot make changes
  'read_only',
]);

export const resellerStatus = pgEnum('ResellerStatus', [
  // Reseller is operational and can manage their assigned institutes
  'active',
  // Reseller access frozen by platform admin — their institutes remain accessible directly
  'suspended',
  // Reseller permanently removed — institutes reassigned to platform or another reseller
  'deleted',
]);

export const groupStatus = pgEnum('GroupStatus', [
  // Institute group is operational — member institutes can share resources and reports
  'ACTIVE',
  // Group voluntarily deactivated — member institutes continue independently
  'INACTIVE',
  // Group forcibly blocked by platform admin — all group-level operations frozen
  'SUSPENDED',
]);

export const subjectType = pgEnum('SubjectType', [
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
]);
