/**
 * Names, slugs, credentials, and rich-shape SEED / E2E_USERS objects shared by:
 *   - Vitest E2E suites (e2e/api-gateway-e2e/**)
 *   - Playwright UI suites (e2e/web-{admin,institute,reseller}-e2e/**)
 *   - The seed script itself (scripts/seed.ts)
 *
 * IDs are the canonical source of truth in `scripts/seed-ids.ts` (zero
 * @roviq/* imports, Vitest-resolvable from any project). They are
 * re-exported here for callers that want everything from one path.
 *
 * Rules:
 *   - NEVER hardcode a seed name, slug, password, or username outside this
 *     file. Hardcoded IDs go in `scripts/seed-ids.ts`.
 *   - Passwords stay plaintext; the seeder hashes them at run time. They
 *     must each be at least `NEW_PASSWORD_MIN_LENGTH` characters
 *     (`@roviq/common-types`) so the password-change suite can roll any
 *     rotated password back via `changePassword` in `afterAll`. A runtime
 *     guard at module load validates the constraint — break the rule and
 *     every importer fails fast at startup.
 *   - This file must keep ZERO `@roviq/*` imports for runtime
 *     resolvability under Vitest. NEW_PASSWORD_MIN_LENGTH is duplicated
 *     as a literal constant below — kept honest by the runtime guard.
 */
import { SEED_IDS } from '../../scripts/seed-ids';

// Re-export so `import { SEED_IDS } from '.../seed-fixtures'` works.
export { SEED_IDS };

// ─── Names (human-readable, may be localised) ────────────────────────────
export const SEED_NAMES = {
  RESELLER_DIRECT: 'Roviq Direct',
  INSTITUTE_1: { en: 'Saraswati Vidya Mandir', hi: 'सरस्वती विद्या मंदिर' },
  INSTITUTE_2: { en: 'Rajasthan Public School', hi: 'राजस्थान पब्लिक स्कूल' },
} as const;

// ─── Slugs (URL-safe, used by seed insert + lookup queries) ──────────────
export const SEED_SLUGS = {
  INSTITUTE_1: 'saraswati-vidya-mandir',
  INSTITUTE_2: 'rajasthan-public-school',
} as const;

// ─── Credentials (plaintext; seeder hashes at runtime) ───────────────────
export const SEED_CREDENTIALS = {
  ADMIN: { username: 'admin', password: 'admin123' },
  RESELLER: { username: 'reseller1', password: 'reseller123' },
  TEACHER: { username: 'teacher1', password: 'teacher123' },
  STUDENT: { username: 'student1', password: 'student123' },
  GUARDIAN: { username: 'guardian1', password: 'guardian123' },
} as const;

// Mirrors `NEW_PASSWORD_MIN_LENGTH` from
// `libs/shared/common-types/src/lib/policy/password-policy.ts`. Duplicated
// as a literal because this module must not import from `@roviq/*` (Vitest
// resolution constraint). The runtime guard below makes the duplication
// self-correcting: bump NEW_PASSWORD_MIN_LENGTH and the next test run
// fails until passwords are rotated.
const TEST_PASSWORD_MIN_LENGTH = 8;
for (const [name, cred] of Object.entries(SEED_CREDENTIALS)) {
  if (cred.password.length < TEST_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `SEED_CREDENTIALS.${name}.password ('${cred.password}') is shorter than ` +
        `TEST_PASSWORD_MIN_LENGTH (${TEST_PASSWORD_MIN_LENGTH}). The seeder ` +
        'rejects passwords below NEW_PASSWORD_MIN_LENGTH from @roviq/common-types.',
    );
  }
}

// ─── Public surface for E2E tests ─────────────────────────────────────────
// Mirrors the previous shape of `e2e/shared/seed.ts` so callers don't break.
export const SEED = {
  INSTITUTE_1: {
    id: SEED_IDS.INSTITUTE_1,
    name: SEED_NAMES.INSTITUTE_1.en,
    nameHi: SEED_NAMES.INSTITUTE_1.hi,
  },
  INSTITUTE_2: {
    id: SEED_IDS.INSTITUTE_2,
    name: SEED_NAMES.INSTITUTE_2.en,
    nameHi: SEED_NAMES.INSTITUTE_2.hi,
  },
  ADMIN_USER: {
    id: SEED_IDS.USER_ADMIN,
    username: SEED_CREDENTIALS.ADMIN.username,
  },
  TEACHER_USER: {
    id: SEED_IDS.USER_TEACHER,
    username: SEED_CREDENTIALS.TEACHER.username,
  },
  STUDENT_USER: {
    id: SEED_IDS.USER_STUDENT,
    username: SEED_CREDENTIALS.STUDENT.username,
  },
  GUARDIAN_USER: {
    id: SEED_IDS.USER_GUARDIAN,
    username: SEED_CREDENTIALS.GUARDIAN.username,
    membershipId: SEED_IDS.MEMBERSHIP_GUARDIAN_INST1,
  },
  STUDENT_PROFILE_1: {
    id: SEED_IDS.STUDENT_PROFILE_1,
  },
  GUARDIAN_PROFILE_1: {
    id: SEED_IDS.GUARDIAN_PROFILE_1,
  },
  ACADEMIC_YEAR_INST1: {
    id: SEED_IDS.ACADEMIC_YEAR_INST1,
  },
  ACADEMIC_YEAR_INST2: {
    id: SEED_IDS.ACADEMIC_YEAR_INST2,
  },
  RESELLER: {
    id: SEED_IDS.RESELLER_DIRECT,
    name: SEED_NAMES.RESELLER_DIRECT,
  },
} as const;

/**
 * Test credentials used by Playwright + Vitest E2E auth helpers.
 *
 * INSTITUTE_ADMIN and PLATFORM_ADMIN currently share the same seed user
 * (`admin`) — that user has both a platform membership and institute
 * memberships, so the same credentials drive `instituteLogin`, `adminLogin`,
 * and the Playwright login flows. If a future seeder splits them, update
 * the aliases here.
 */
export const E2E_USERS = {
  INSTITUTE_ADMIN: SEED_CREDENTIALS.ADMIN,
  PLATFORM_ADMIN: SEED_CREDENTIALS.ADMIN,
  RESELLER: SEED_CREDENTIALS.RESELLER,
  TEACHER: SEED_CREDENTIALS.TEACHER,
  STUDENT: SEED_CREDENTIALS.STUDENT,
  GUARDIAN: SEED_CREDENTIALS.GUARDIAN,
} as const;
