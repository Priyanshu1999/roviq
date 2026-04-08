/**
 * Shared seed entity data for all E2E tests (Vitest E2E + Playwright).
 *
 * IDs are imported from `scripts/seed-ids.ts` (single source of truth).
 * Names mirror the literals in `scripts/seed.ts` — when an entity is renamed,
 * update both `scripts/seed.ts` AND this file. Tests then update automatically.
 *
 * RULE: Never hardcode seed entity names in test files. Import from here.
 */
import { SEED_IDS } from '../../scripts/seed-ids';

export const SEED = {
  INSTITUTE_1: {
    id: SEED_IDS.INSTITUTE_1,
    name: 'Saraswati Vidya Mandir',
    nameHi: 'सरस्वती विद्या मंदिर',
  },
  INSTITUTE_2: {
    id: SEED_IDS.INSTITUTE_2,
    name: 'Rajasthan Public School',
    nameHi: 'राजस्थान पब्लिक स्कूल',
  },
  ADMIN_USER: {
    id: SEED_IDS.USER_ADMIN,
    username: 'admin',
  },
  TEACHER_USER: {
    id: SEED_IDS.USER_TEACHER,
    username: 'teacher1',
  },
  STUDENT_USER: {
    id: SEED_IDS.USER_STUDENT,
    username: 'student1',
  },
} as const;

// Re-export raw IDs for tests that only need the UUID
export { SEED_IDS };
