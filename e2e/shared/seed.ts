/**
 * Re-export shim — kept so existing `from '../../shared/seed'` imports
 * across Vitest E2E + Playwright suites keep working. The canonical
 * fixture source is `seed-fixtures.ts`.
 */
export { SEED, SEED_IDS } from './seed-fixtures';
