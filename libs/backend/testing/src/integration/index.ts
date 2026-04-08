/**
 * Heavy entry point for `@roviq/testing/integration`.
 *
 * This barrel is for INTEGRATION tests that boot a real NestJS app. It pulls
 * in supertest, Drizzle, @node-rs/argon2, and the NestJS testing module. Do
 * NOT import from here inside a unit test — use `@roviq/testing` instead.
 */

// Re-export createMock for convenience.
export { createMock } from '@golevelup/ts-vitest';
// Re-export token factories so integration tests only need one import.
export {
  createImpersonationToken,
  createInstituteToken,
  createPlatformToken,
  createResellerToken,
} from '../token-factories';
// Test data factories — create fresh institutes/resellers per suite.
export {
  type CreateTestInstituteOptions,
  cleanupTestInstitute,
  cleanupTestReseller,
  createTestInstitute,
  createTestReseller,
  RESELLER_DIRECT_ID,
  type TestInstitute,
  type TestReseller,
} from './data-factories';
// supertest GraphQL helper
export {
  type GqlError,
  type GqlRequestOptions,
  type GqlResponse,
  gqlRequest,
} from './gql-request';
// NestJS integration app bootstrapper
export {
  createIntegrationApp,
  createIntegrationAppWithNats,
  type IntegrationAppOptions,
  type IntegrationAppResult,
} from './integration-app';
// Async polling helpers
export { type AuditLogQuery, waitForAuditLog, waitForCondition } from './polling';
// Test-env defaults — callers rarely need this directly; createIntegrationApp
// invokes it automatically before Test.createTestingModule is built.
export { setupTestEnv } from './test-env';
