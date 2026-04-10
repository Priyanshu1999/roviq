/**
 * Shared enum constants for user profile fields (guardians, students, staff).
 *
 * Declared here in `@roviq/common-types` so every layer can read from a
 * single source of truth WITHOUT api-gateway having to depend on
 * `@roviq/database`:
 *
 *   - `libs/database/src/schema/common/enums.ts` imports
 *     `GUARDIAN_EDUCATION_LEVEL_VALUES` and passes it to `pgEnum(...)`,
 *     which means the Postgres enum and the TypeScript union are built
 *     from the exact same readonly tuple (Drizzle preserves the literal
 *     tuple type across module boundaries — verified against
 *     drizzle-orm's `pgEnum<U, T extends Readonly<[U, ...U[]]>>` signature
 *     in `node_modules/drizzle-orm/pg-core/columns/enum.d.ts`).
 *
 *   - `apps/api-gateway/src/institute/guardian/models/guardian.model.ts`
 *     imports the `GuardianEducationLevel` const alias and feeds it to
 *     NestJS `registerEnumType` / `@Field(() => GuardianEducationLevel)`.
 *     Guardian DTOs use the same identifier for `@IsEnum`.
 *
 *   - Frontend `apps/web/.../guardians/new/page.tsx` imports both the
 *     tuple (to iterate Select options) and the const alias (for the
 *     `z.enum(...)` Zod schema).
 *
 * Per the Roviq enum documentation rule every option has an inline
 * comment explaining its domain meaning.
 */

/**
 * Guardian's highest completed education qualification.
 *
 * Values are UPPER_SNAKE to match the dominant convention across Roviq
 * status/type enums (`userStatus`, `membershipStatus`, `subjectType`, etc.).
 * Adding a level only requires editing this tuple — the derived type,
 * const alias, and downstream Postgres pgEnum all update automatically.
 */
export const GUARDIAN_EDUCATION_LEVEL_VALUES = [
  // No formal education — guardian never attended school
  'ILLITERATE',
  // Up to Class 5 — foundational literacy and numeracy
  'PRIMARY',
  // Up to Class 10/12 — board exam completion at SSC/HSC level
  'SECONDARY',
  // Bachelor's degree (B.A./B.Sc./B.Com/B.E. etc.)
  'GRADUATE',
  // Master's degree (M.A./M.Sc./M.Com/MBA etc.)
  'POST_GRADUATE',
  // Professional degree — MBBS, LLB, CA, CS, architecture, etc.
  'PROFESSIONAL',
] as const;

/** String-literal union derived from the tuple above. */
export type GuardianEducationLevel = (typeof GUARDIAN_EDUCATION_LEVEL_VALUES)[number];

/**
 * Const object whose keys map to themselves — the runtime value needed by
 * NestJS `registerEnumType`, `@Field(() => GuardianEducationLevel)`,
 * class-validator `@IsEnum(GuardianEducationLevel)`, and Zod 4's
 * `z.enum(GuardianEducationLevel)`. Shares the identifier with the type
 * above because TypeScript types and values live in separate namespaces.
 */
export const GuardianEducationLevel = Object.fromEntries(
  GUARDIAN_EDUCATION_LEVEL_VALUES.map((v) => [v, v]),
) as { readonly [K in GuardianEducationLevel]: K };

/**
 * Guardian-student relationship. Used on `student_guardian_links.relationship`
 * to describe how a guardian is related to a student. Consumed by:
 *
 *   - the `GuardianRelationship` Postgres pgEnum (libs/database enums.ts)
 *   - api-gateway DTO `@IsEnum(GuardianRelationship)` on `LinkGuardianInput.relationship`
 *   - frontend Select on the student detail Guardians tab and guardian detail Children tab
 *
 * Values are UPPER_SNAKE per Roviq convention. DB is reset via `tilt trigger db-clean`.
 */
export const GUARDIAN_RELATIONSHIP_VALUES = [
  // Biological or legal father
  'FATHER',
  // Biological or legal mother
  'MOTHER',
  // Court-appointed legal guardian (no biological relation required)
  'LEGAL_GUARDIAN',
  // Father's side grandparent — common enough to track separately for fee/pickup policies
  'GRANDPARENT_PATERNAL',
  // Mother's side grandparent — same reason
  'GRANDPARENT_MATERNAL',
  // Uncle (father's or mother's brother / aunt's spouse)
  'UNCLE',
  // Aunt (father's or mother's sister / uncle's spouse)
  'AUNT',
  // Older sibling acting as primary contact — allowed when parents are unavailable
  'SIBLING',
  // Any relationship not captured above — forces clerk to document context
  'OTHER',
] as const;

/** String-literal union derived from the tuple above. */
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIP_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsIn(GuardianRelationship)`, class-validator
 * `@IsEnum(GuardianRelationship)`, and Zod's `z.enum(GuardianRelationship)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const GuardianRelationship = Object.fromEntries(
  GUARDIAN_RELATIONSHIP_VALUES.map((v) => [v, v]),
) as { readonly [K in GuardianRelationship]: K };

/**
 * Student lifecycle state at a given institute.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('AcademicStatus', ACADEMIC_STATUS_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(AcademicStatus)` + `@IsEnum(AcademicStatus)`
 *   - `apps/web` → Select options, Zod schemas, filter tabs
 */
export const ACADEMIC_STATUS_VALUES = [
  // Student is actively studying at the institute
  'ENROLLED',
  // Student passed and was promoted to the next class
  'PROMOTED',
  // Student failed and was retained in the same class
  'DETAINED',
  // Student completed the final year (Class 10/12 board exam)
  'GRADUATED',
  // Student formally transferred to another institute (TC issued)
  'TRANSFERRED_OUT',
  // Student left without formal transfer documentation
  'DROPPED_OUT',
  // Student voluntarily withdrawn by guardian
  'WITHDRAWN',
  // Student temporarily barred from attending (disciplinary)
  'SUSPENDED',
  // Student permanently removed for disciplinary reasons
  'EXPELLED',
  // Student returned after dropout/withdrawal
  'RE_ENROLLED',
  // Student completed coaching program (coaching institutes only)
  'PASSOUT',
] as const;

export type AcademicStatus = (typeof ACADEMIC_STATUS_VALUES)[number];
export const AcademicStatus = Object.fromEntries(ACADEMIC_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in AcademicStatus]: K;
};

/**
 * How the student was admitted to the institute.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('AdmissionType', ADMISSION_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(AdmissionType)` + `@IsEnum(AdmissionType)`
 *   - `apps/web` → Select options, Zod schemas
 */
export const ADMISSION_TYPE_VALUES = [
  // Fresh admission — student newly joining the institute
  'NEW',
  // Admitted under Right to Education Act Section 12(1)(c) reservation
  'RTE',
  // Mid-session admission from another institute
  'LATERAL_ENTRY',
  // Returning student after withdrawal or dropout
  'RE_ADMISSION',
  // Formal transfer from another institute with TC
  'TRANSFER',
] as const;

export type AdmissionType = (typeof ADMISSION_TYPE_VALUES)[number];
export const AdmissionType = Object.fromEntries(ADMISSION_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in AdmissionType]: K;
};

/**
 * Social category for government reporting (UDISE+, RTE Act).
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('SocialCategory', SOCIAL_CATEGORY_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(SocialCategory)` + `@IsEnum(SocialCategory)`
 *   - `apps/web` → Select options, Zod schemas
 */
export const SOCIAL_CATEGORY_VALUES = [
  // No reservation category — general/open category
  'GENERAL',
  // Scheduled Caste — constitutional reservation category
  'SC',
  // Scheduled Tribe — constitutional reservation category
  'ST',
  // Other Backward Classes — OBC reservation category
  'OBC',
  // Economically Weaker Section — income-based reservation
  'EWS',
] as const;

export type SocialCategory = (typeof SOCIAL_CATEGORY_VALUES)[number];
export const SocialCategory = Object.fromEntries(SOCIAL_CATEGORY_VALUES.map((v) => [v, v])) as {
  readonly [K in SocialCategory]: K;
};

/**
 * Religious minority community per National Commission for Minorities Act.
 * Only applies when `isMinority = true` on the student profile.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('MinorityType', MINORITY_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(MinorityType)` + `@IsEnum(MinorityType)`
 *   - `apps/web` → Select options (conditional on isMinority checkbox)
 */
export const MINORITY_TYPE_VALUES = [
  // Islam — largest minority community in India
  'MUSLIM',
  // Christianity — includes Catholic, Protestant, and other denominations
  'CHRISTIAN',
  // Sikhism — recognized minority under NCM Act
  'SIKH',
  // Buddhism — recognized minority under NCM Act
  'BUDDHIST',
  // Zoroastrianism — smallest recognized minority community
  'PARSI',
  // Jainism — added to NCM list in 2014
  'JAIN',
  // Any other minority community not listed above
  'OTHER',
] as const;

export type MinorityType = (typeof MINORITY_TYPE_VALUES)[number];
export const MinorityType = Object.fromEntries(MINORITY_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in MinorityType]: K;
};

/**
 * Academic stream for senior secondary students (Class 11-12).
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('StudentStream', STUDENT_STREAM_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(StudentStream)` + `@IsEnum(StudentStream)`
 *   - `apps/web` → Select options (conditional on class level)
 */
export const STUDENT_STREAM_VALUES = [
  // Physics + Chemistry + Mathematics (engineering focus)
  'SCIENCE_PCM',
  // Physics + Chemistry + Biology (medical focus)
  'SCIENCE_PCB',
  // Accountancy + Business Studies + Economics
  'COMMERCE',
  // History + Political Science + Geography and electives
  'ARTS',
  // Skill-based subjects — IT, AI, agriculture, etc.
  'VOCATIONAL',
] as const;

export type StudentStream = (typeof STUDENT_STREAM_VALUES)[number];
export const StudentStream = Object.fromEntries(STUDENT_STREAM_VALUES.map((v) => [v, v])) as {
  readonly [K in StudentStream]: K;
};

/**
 * Staff employment type at the institute.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('EmploymentType', EMPLOYMENT_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(EmploymentType)` + `@IsEnum(EmploymentType)`
 *   - `apps/web` → Select options, Zod schemas
 */
export const EMPLOYMENT_TYPE_VALUES = [
  // Permanent/regular employee on institute payroll
  'REGULAR',
  // Fixed-term contract employee
  'CONTRACTUAL',
  // Part-time staff — fewer than full working hours
  'PART_TIME',
  // Guest faculty engaged for specific sessions or subjects
  'GUEST',
  // Unpaid volunteer contributing time to the institute
  'VOLUNTEER',
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPE_VALUES)[number];
export const EmploymentType = Object.fromEntries(EMPLOYMENT_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in EmploymentType]: K;
};

/**
 * User gender — stored on user_profiles.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('Gender', GENDER_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(Gender)` + `@IsEnum(Gender)`
 *   - `apps/web` → Select options
 */
export const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER'] as const;

export type Gender = (typeof GENDER_VALUES)[number];
export const Gender = Object.fromEntries(GENDER_VALUES.map((v) => [v, v])) as {
  readonly [K in Gender]: K;
};

/**
 * User address type — stored on user_addresses.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('AddressType', ADDRESS_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(AddressType)` + `@IsEnum(AddressType)`
 *   - `apps/web` → Select options
 */
export const ADDRESS_TYPE_VALUES = [
  // Permanent home address — used for official correspondence
  'PERMANENT',
  // Current residential address — may differ from permanent
  'CURRENT',
  // Emergency contact address — reached during crises
  'EMERGENCY',
] as const;

export type AddressType = (typeof ADDRESS_TYPE_VALUES)[number];
export const AddressType = Object.fromEntries(ADDRESS_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in AddressType]: K;
};

/**
 * Bot profile lifecycle status.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('BotStatus', BOT_STATUS_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(BotStatus)` — replaces inline `BotStatusEnum`
 */
export const BOT_STATUS_VALUES = [
  // Bot is operational — can authenticate and process requests
  'ACTIVE',
  // Bot temporarily blocked by admin — API calls rejected
  'SUSPENDED',
  // Bot permanently disabled — must be re-created
  'DEACTIVATED',
] as const;

export type BotStatus = (typeof BOT_STATUS_VALUES)[number];
export const BotStatus = Object.fromEntries(BOT_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in BotStatus]: K;
};

/**
 * Bot API rate limit tier — controls request throughput.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('BotRateLimitTier', BOT_RATE_LIMIT_TIER_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(BotRateLimitTier)` — replaces inline `RateLimitTierEnum`
 */
export const BOT_RATE_LIMIT_TIER_VALUES = [
  // 10 req/min — suitable for notification bots
  'LOW',
  // 60 req/min — suitable for chatbots and integrations
  'MEDIUM',
  // 300 req/min — suitable for bulk operations and report generation
  'HIGH',
] as const;

export type BotRateLimitTier = (typeof BOT_RATE_LIMIT_TIER_VALUES)[number];
export const BotRateLimitTier = Object.fromEntries(
  BOT_RATE_LIMIT_TIER_VALUES.map((v) => [v, v]),
) as { readonly [K in BotRateLimitTier]: K };

/**
 * User identifier type — government/institutional ID documents stored per user.
 *
 * Single source of truth for:
 *   - `libs/database` → `pgEnum('UserIdentifierType', USER_IDENTIFIER_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(UserIdentifierType)` + `@IsEnum`
 *   - frontend Zod schemas + Select options
 *
 * Values are UPPER_SNAKE per Roviq convention.
 */
export const USER_IDENTIFIER_TYPE_VALUES = [
  // 12-digit UIDAI Aadhaar number (Verhoeff checksum validated)
  'AADHAAR',
  // 10-character PAN card issued by Income Tax Department
  'PAN',
  // Indian passport number
  'PASSPORT',
  // Voter ID (EPIC) issued by Election Commission of India
  'VOTER_ID',
  // 12-digit Automated Permanent Academic Account Registry ID (MoE, India)
  'APAAR',
  // Permanent Education Number — unique student ID across boards
  'PEN',
  // CBSE board registration number for students
  'CBSE_REGISTRATION',
  // BSEH board enrollment number for students
  'BSEH_ENROLLMENT',
  // Shala Darpan ID — Rajasthan state school portal identifier
  'SHALA_DARPAN_ID',
  // Parivar Pehchan Patra — Haryana family ID
  'PARIVAR_PEHCHAN_PATRA',
  // Jan Aadhaar — Rajasthan family ID
  'JAN_AADHAAR',
  // Migration certificate number — issued when transferring between boards
  'MIGRATION_CERTIFICATE',
] as const;

export type UserIdentifierType = (typeof USER_IDENTIFIER_TYPE_VALUES)[number];
export const UserIdentifierType = Object.fromEntries(
  USER_IDENTIFIER_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in UserIdentifierType]: K };

/**
 * Student/user document type — uploaded files tied to a user profile.
 *
 * Single source of truth for:
 *   - `libs/database` → `pgEnum('UserDocumentType', USER_DOCUMENT_TYPE_VALUES)`
 *   - `apps/api-gateway` → document upload validation
 */
export const USER_DOCUMENT_TYPE_VALUES = [
  // Government-issued birth certificate
  'BIRTH_CERTIFICATE',
  // Transfer certificate received from previous institute
  'TC_INCOMING',
  // Academic report card / marksheet
  'REPORT_CARD',
  // Aadhaar card photocopy
  'AADHAAR_CARD',
  // Caste certificate issued by competent authority
  'CASTE_CERTIFICATE',
  // Income certificate for fee concession / scholarship
  'INCOME_CERTIFICATE',
  // Economically Weaker Section certificate
  'EWS_CERTIFICATE',
  // Medical fitness or health certificate
  'MEDICAL_CERTIFICATE',
  // Disability certificate (PwD) issued by medical board
  'DISABILITY_CERTIFICATE',
  // Address proof document (utility bill, ration card, etc.)
  'ADDRESS_PROOF',
  // Passport-size photograph
  'PASSPORT_PHOTO',
  // Family photograph (required by some institutes)
  'FAMILY_PHOTO',
  // Below Poverty Line card
  'BPL_CARD',
  // Transfer order (for defence/govt employee wards)
  'TRANSFER_ORDER',
  // No Objection Certificate from previous institute/board
  'NOC',
  // Affidavit (name change, gap year, etc.)
  'AFFIDAVIT',
  // Any other document not covered above
  'OTHER',
] as const;

export type UserDocumentType = (typeof USER_DOCUMENT_TYPE_VALUES)[number];
export const UserDocumentType = Object.fromEntries(
  USER_DOCUMENT_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in UserDocumentType]: K };

/**
 * Promotion status — outcome of year-end promotion decision for a student academic record.
 *
 * Single source of truth for:
 *   - `libs/database` → `pgEnum('PromotionStatus', PROMOTION_STATUS_VALUES)`
 *   - `apps/api-gateway` → TC issuance, student rollover
 */
export const PROMOTION_STATUS_VALUES = [
  // Awaiting year-end decision
  'PENDING',
  // Student promoted to next standard
  'PROMOTED',
  // Student detained / held back in current standard
  'DETAINED',
  // Student completed final year (Class 10/12 or coaching program)
  'GRADUATED',
  // Student left this institute before promotion decision
  'TRANSFERRED',
] as const;

export type PromotionStatus = (typeof PROMOTION_STATUS_VALUES)[number];
export const PromotionStatus = Object.fromEntries(PROMOTION_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in PromotionStatus]: K;
};

/**
 * Staff qualification type — academic or professional credential.
 *
 * Single source of truth for:
 *   - `libs/database` → `pgEnum('QualificationType', QUALIFICATION_TYPE_VALUES)`
 */
export const QUALIFICATION_TYPE_VALUES = [
  // Academic degree (B.Ed, M.Sc, PhD, etc.)
  'ACADEMIC',
  // Professional certification (CTET, NET, etc.)
  'PROFESSIONAL',
] as const;

export type QualificationType = (typeof QUALIFICATION_TYPE_VALUES)[number];
export const QualificationType = Object.fromEntries(
  QUALIFICATION_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in QualificationType]: K };
