/**
 * Vitest setup file — runs inside every test worker before any test code.
 *
 * Loads `.env` so tests that read connection strings via `process.env.DATABASE_URL_TEST`
 * resolve to the test database (`roviq_test`) instead of falling back to hardcoded
 * dev defaults. Without this, every standalone DB integration test would silently
 * connect to the dev database.
 */
import 'dotenv/config';
