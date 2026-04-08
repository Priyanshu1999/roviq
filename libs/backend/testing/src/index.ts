/**
 * Lightweight entry point for `@roviq/testing`.
 *
 * This barrel is safe to import from UNIT tests: zero NestJS imports, zero pg
 * imports, zero environment mutation. It exposes only:
 *   - `createMock<T>()` (re-exported from `@golevelup/ts-vitest`)
 *   - JWT token factories (signed via `jsonwebtoken`)
 *
 * For integration tests that boot NestJS, import from
 * `@roviq/testing/integration` instead — that subpath pulls in supertest,
 * Drizzle, and Nest testing machinery, which is inappropriate for unit tests.
 */

// Re-export createMock so all test utilities flow through one entry point.
export { createMock } from '@golevelup/ts-vitest';

// JWT token factories — produce real signed tokens for the three auth scopes.
export {
  createImpersonationToken,
  createInstituteToken,
  createPlatformToken,
  createResellerToken,
} from './token-factories';
