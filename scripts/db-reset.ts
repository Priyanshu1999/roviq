/**
 * Reset the database: drop all tables/enums, re-push schema, optionally seed.
 *
 * Usage:
 *   pnpm db:reset          — drop + push (dev database)
 *   pnpm db:reset --seed   — drop + push + seed
 *   pnpm db:reset --test   — target roviq_test database (for e2e)
 *
 * Uses Drizzle's db instance — no raw psql dependency.
 * Safety: refuses to run when NODE_ENV=production.
 */
import { execSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

if (process.env.NODE_ENV === 'production') {
  console.error('Cannot reset database in production.');
  process.exit(1);
}

const useTestDb = process.argv.includes('--test');
const connectionString = useTestDb
  ? process.env.DATABASE_URL_TEST_MIGRATE ||
    'postgresql://roviq:roviq_dev@localhost:5433/roviq_test'
  : process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

async function main() {
  const shouldSeed = process.argv.includes('--seed');

  // 1. Drop all tables in public schema
  const tables = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  if (tables.rows.length > 0) {
    console.log(`Dropping ${tables.rows.length} tables...`);
    for (const { table_name } of tables.rows) {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "public"."${table_name}" CASCADE`));
    }
  }

  // 2. Drop all enum types in public schema
  const enums = await db.execute<{ typname: string }>(sql`
    SELECT typname FROM pg_type
    WHERE typtype = 'e'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `);

  if (enums.rows.length > 0) {
    console.log(`Dropping ${enums.rows.length} enum types...`);
    for (const { typname } of enums.rows) {
      await db.execute(sql.raw(`DROP TYPE IF EXISTS "public"."${typname}" CASCADE`));
    }
  }

  // 3. Drop drizzle migration tracking table
  await db.execute(sql.raw('DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE'));
  await db.execute(sql.raw('DROP SCHEMA IF EXISTS "drizzle" CASCADE'));

  await pool.end();
  console.log('Database cleared.');

  // 4. Re-push schema (use superuser so tables are owned by the right role)
  console.log('Pushing schema...');
  execSync('drizzle-kit push --force --config=drizzle.config.ts', {
    stdio: 'inherit',
    cwd: 'libs/database',
    env: { ...process.env, DATABASE_URL: connectionString },
  });

  // 5. Ensure app role can switch to admin (needed for withAdmin())
  // INHERIT FALSE prevents roviq_app from automatically gaining admin policy privileges.
  console.log('Granting roles...');
  const adminPool = new Pool({ connectionString });
  await adminPool.query('GRANT roviq_admin TO roviq_app WITH INHERIT FALSE, SET TRUE');
  await adminPool.end();

  // 6. Optionally seed
  if (shouldSeed) {
    console.log('Seeding...');
    execSync('pnpm db:seed', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL_MIGRATE: connectionString },
    });
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
