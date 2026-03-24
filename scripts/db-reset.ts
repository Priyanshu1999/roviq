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
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

if (process.env.NODE_ENV === 'production') {
  console.error('Cannot reset database in production.');
  process.exit(1);
}

const useTestDb = process.argv.includes('--test');
// db-reset needs superuser (roviq) to drop/create tables — always use MIGRATE URL
const connectionString = useTestDb
  ? process.env.DATABASE_URL_TEST_MIGRATE ||
    'postgresql://roviq:roviq_dev@localhost:5432/roviq_test'
  : process.env.DATABASE_URL_MIGRATE || 'postgresql://roviq:roviq_dev@localhost:5432/roviq';

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

  // 3b. Ensure all DB roles exist (may not exist in fresh e2e postgres)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_app') THEN CREATE ROLE roviq_app NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_reseller') THEN CREATE ROLE roviq_reseller NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_admin') THEN CREATE ROLE roviq_admin NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'roviq_pooler') THEN CREATE ROLE roviq_pooler WITH LOGIN PASSWORD 'roviq_pooler_dev' NOINHERIT; END IF;
    END $$
  `);

  await pool.end();
  console.log('Database cleared.');

  // 4. Re-push schema (use superuser so tables are owned by the right role)
  console.log('Pushing schema...');
  execSync('drizzle-kit push --force --config=drizzle.config.ts', {
    stdio: 'inherit',
    cwd: 'libs/database',
    env: { ...process.env, DATABASE_URL: connectionString, DATABASE_URL_MIGRATE: connectionString },
  });

  // 5. Re-apply role grants for the four-role model (roviq_pooler → app/reseller/admin)
  console.log('Granting roles...');
  const adminPool = new Pool({ connectionString });
  await adminPool.query(`
    -- Pool role can assume all three app roles via SET LOCAL ROLE
    GRANT roviq_app TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
    GRANT roviq_reseller TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
    GRANT roviq_admin TO roviq_pooler WITH INHERIT FALSE, SET TRUE;

    -- Schema access
    GRANT USAGE ON SCHEMA public TO roviq_pooler;
    GRANT USAGE ON SCHEMA public TO roviq_app;
    GRANT USAGE ON SCHEMA public TO roviq_reseller;
    GRANT USAGE ON SCHEMA public TO roviq_admin;

    -- DML on existing tables
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO roviq_reseller;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;

    -- Extra grants for reseller tables (conditional — may not exist in test DB)
    DO $$ BEGIN
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'reseller_memberships') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;
      END IF;
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'impersonation_sessions') THEN
        GRANT SELECT, INSERT, UPDATE ON impersonation_sessions TO roviq_reseller;
      END IF;
    END $$;
  `);

  // FORCE RLS on all tables (db:push only does ENABLE, not FORCE)
  // Skip partition children — FORCE on parent propagates automatically
  const tablesForRls = await adminPool.query(`
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
  `);
  for (const { tablename } of tablesForRls.rows) {
    await adminPool.query(`ALTER TABLE "${tablename}" FORCE ROW LEVEL SECURITY`);
  }

  // 5b. Fix role inheritance (roviq_app/reseller must NOT inherit from superuser)
  await adminPool.query(`
    DO $$ BEGIN
      -- Remove superuser inheritance that Docker init may have added
      IF EXISTS (
        SELECT 1 FROM pg_auth_members am
        JOIN pg_roles r ON r.oid = am.roleid
        JOIN pg_roles m ON m.oid = am.member
        WHERE m.rolname = 'roviq_app' AND r.rolname = 'roviq' AND am.inherit_option = true
      ) THEN
        REVOKE roviq FROM roviq_app;
        REVOKE roviq FROM roviq_reseller;
        REVOKE roviq FROM roviq_admin;
        -- Re-grant without INHERIT for admin (needs SET for withAdmin wrapper)
        GRANT roviq TO roviq_admin WITH INHERIT FALSE, SET TRUE;
      END IF;
    END $$;
  `);

  // 5c. Table-specific GRANT overrides (tighten broad grants above)
  console.log('Applying table-specific GRANT restrictions...');
  await adminPool.query(`
    -- institutes: roviq_app gets SELECT only (tenant root — read own institute)
    REVOKE INSERT, UPDATE, DELETE ON institutes FROM roviq_app;

    -- institutes: roviq_reseller can INSERT + UPDATE (create with approval, suspend/reactivate)
    GRANT INSERT, UPDATE ON institutes TO roviq_reseller;

    -- audit_logs: immutable for non-admin roles (SELECT + INSERT only)
    REVOKE UPDATE, DELETE ON audit_logs FROM roviq_app;
    REVOKE UPDATE, DELETE ON audit_logs FROM roviq_reseller;

    -- auth_events: roviq_app can INSERT but not SELECT (admin-only readable)
    REVOKE SELECT ON auth_events FROM roviq_app;
  `);

  // 5d. PostgreSQL functions (drizzle-kit push cannot create these)
  console.log('Creating PostgreSQL functions...');
  await adminPool.query(`
    -- ROV-152: Atomic sequence increment + format
    CREATE OR REPLACE FUNCTION next_sequence_value(p_tenant_id UUID, p_sequence_name VARCHAR)
    RETURNS TABLE (next_val BIGINT, formatted VARCHAR) AS $$
      UPDATE tenant_sequences
      SET current_value = current_value + 1
      WHERE tenant_id = p_tenant_id AND sequence_name = p_sequence_name
      RETURNING current_value, REPLACE(
        REPLACE(format_template, '{value:04d}', LPAD(current_value::text, 4, '0')),
        '{prefix}', COALESCE(prefix, '')
      )::varchar;
    $$ LANGUAGE SQL;

    GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_app;
    GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_reseller;
    GRANT EXECUTE ON FUNCTION next_sequence_value(UUID, VARCHAR) TO roviq_admin;
  `);

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
