export { SEED_IDS } from '../../scripts/seed-ids';

/**
 * Single source of truth for E2E test credentials.
 *
 * INSTITUTE_ADMIN and PLATFORM_ADMIN currently share the same seed user
 * (`admin` / `admin123`) — that user has both a platform membership and
 * institute memberships, so the same credentials can drive `instituteLogin`
 * and `adminLogin` mutations.
 *
 * Credentials must match `scripts/seed.ts`.
 */
export const E2E_USERS = {
  INSTITUTE_ADMIN: { username: 'admin', password: 'admin123' },
  PLATFORM_ADMIN: { username: 'admin', password: 'admin123' },
  TEACHER: { username: 'teacher1', password: 'teacher123' },
  STUDENT: { username: 'student1', password: 'student123' },
} as const;
