/**
 * Re-export shim — kept so existing `from '../../shared/e2e-users'`
 * imports across Vitest E2E + Playwright suites keep working. The
 * canonical fixture source is `seed-fixtures.ts`.
 */
export { E2E_USERS } from './seed-fixtures';
