/**
 * Shared enum constants for user profile fields (guardians, students, staff).
 *
 * Backend Drizzle schemas, NestJS DTOs/GraphQL enums, and frontend Select
 * options all import from this module so the allowed values stay in sync
 * across layers. Per the Roviq enum documentation rule every option has
 * an inline comment explaining its domain meaning.
 */

/**
 * Guardian highest-education level. Enforced by the `chk_education_level`
 * CHECK constraint on `guardian_profiles` and registered as the GraphQL
 * `GuardianEducationLevel` enum in the backend DTOs. Frontend forms drive
 * their Select options from `Object.values(GuardianEducationLevel)`.
 */
export enum GuardianEducationLevel {
  /** No formal education — used for guardians who never attended school. */
  Illiterate = 'illiterate',
  /** Up to Class 5 — foundational literacy and numeracy. */
  Primary = 'primary',
  /** Up to Class 10/12 — board exam completion at SSC/HSC level. */
  Secondary = 'secondary',
  /** Bachelor's degree (B.A./B.Sc./B.Com/B.E. etc.). */
  Graduate = 'graduate',
  /** Master's degree (M.A./M.Sc./M.Com/MBA etc.). */
  PostGraduate = 'post_graduate',
  /** Professional degree — MBBS, LLB, CA, CS, architecture, etc. */
  Professional = 'professional',
}
