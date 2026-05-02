// Runs ONCE before any integration test worker starts. Applies pending
// Drizzle migrations to DATABASE_URL_TEST_MIGRATE (host's `roviq_test`),
// idempotently. Without this, a teammate who pulls a branch with a new
// migration sees cryptic FK / column errors until they remember to run
// `pnpm db:reset --test --seed`.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST_MIGRATE;
  if (!url) {
    throw new Error('DATABASE_URL_TEST_MIGRATE is not set; cannot prepare integration test DB');
  }

  const result = spawnSync('drizzle-kit', ['migrate', '--config=drizzle.config.ts'], {
    stdio: 'inherit',
    cwd: resolve(__dirname, 'libs/database'),
    env: { ...process.env, DATABASE_URL_MIGRATE: url },
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`drizzle-kit migrate failed (exit ${result.status})`);
  }
}
