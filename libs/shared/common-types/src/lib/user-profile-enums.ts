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
 * to describe how a guardian is related to a student (father/mother/legal
 * guardian/grandparent/etc.). Consumed by:
 *
 *   - api-gateway DTO `@IsIn(GUARDIAN_RELATIONSHIP_VALUES)` on
 *     `LinkGuardianInput.relationship` and the `linkGuardianToStudent`
 *     mutation path
 *   - frontend Select on the student detail page Guardians tab and the
 *     guardian detail page Children tab (ROV-224)
 *
 * Values are lowercase_snake because the existing `student_guardian_links`
 * rows and the seed data use this casing — flipping to UPPER_SNAKE would
 * require a data migration that's out of scope for this refactor.
 */
export const GUARDIAN_RELATIONSHIP_VALUES = [
  // Biological or legal father
  'father',
  // Biological or legal mother
  'mother',
  // Court-appointed legal guardian (no biological relation required)
  'legal_guardian',
  // Father's side grandparent — common enough to track separately for fee/pickup policies
  'grandparent_paternal',
  // Mother's side grandparent — same reason
  'grandparent_maternal',
  // Uncle (father's or mother's brother / aunt's spouse)
  'uncle',
  // Aunt (father's or mother's sister / uncle's spouse)
  'aunt',
  // Older sibling acting as primary contact — allowed when parents are unavailable
  'sibling',
  // Any relationship not captured above — forces clerk to document in the relationship free-text field
  'other',
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
