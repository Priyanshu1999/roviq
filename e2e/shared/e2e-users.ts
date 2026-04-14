/**
 * Shared test credentials for all E2E tests (Vitest E2E + Playwright).
 *
 * INSTITUTE_ADMIN and PLATFORM_ADMIN currently share the same seed user
 * (`admin` / `admin123`) — that user has both a platform membership and
 * institute memberships, so the same credentials can drive `instituteLogin`,
 * `adminLogin`, and the Playwright login flows.
 *
 * Credentials must match `scripts/seed.ts`.
 */
export const E2E_USERS = {
  INSTITUTE_ADMIN: { username: 'admin', password: 'admin123' },
  PLATFORM_ADMIN: { username: 'admin', password: 'admin123' },
  RESELLER: { username: 'reseller1', password: 'reseller123' },
  TEACHER: { username: 'teacher1', password: 'teacher123' },
  STUDENT: { username: 'student1', password: 'student123' },
  GUARDIAN: { username: 'guardian1', password: 'guardian123' },
} as const;
