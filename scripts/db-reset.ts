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
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

if (process.env.NODE_ENV === 'production') {
  console.error('Cannot reset database in production.');
  process.exit(1);
}

const useTestDb = process.argv.includes('--test');
// db-reset needs superuser (roviq) to drop/create tables — always use MIGRATE URL
const connectionString = useTestDb
  ? process.env.DATABASE_URL_TEST_MIGRATE ||
    'postgresql://roviq:roviq_dev@localhost:5434/roviq_test'
  : process.env.DATABASE_URL_MIGRATE || 'postgresql://roviq:roviq_dev@localhost:5434/roviq';

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

  // 3c. Enable required extensions (must exist before drizzle-kit push creates indexes)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  // 3d. Install IMMUTABLE helper functions used by generated-column expressions.
  // Must exist BEFORE drizzle-kit push creates tables that reference them,
  // otherwise the CREATE TABLE fails with "function does not exist".
  //
  // `i18n_text_to_string` flattens an i18nText jsonb map (`{ en: "Raj",
  // hi: "राज" }`) into a space-separated string of its values. PostgreSQL 18
  // forbids subqueries inside `GENERATED ALWAYS AS` expressions, so the
  // `SELECT ... FROM jsonb_each_text(val)` is wrapped in an IMMUTABLE
  // function — the function call is not itself a subquery, so the generated
  // column expression is valid. Used by `user_profiles.search_vector`.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION i18n_text_to_string(val jsonb)
    RETURNS text
    IMMUTABLE
    LANGUAGE sql
    AS $$
      SELECT string_agg(value, ' ') FROM jsonb_each_text(val);
    $$;
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

  // 5c. Apply custom SQL migrations (raw SQL GRANTs, policies, functions, indexes, REVOKEs)
  //
  // `drizzle-kit push` only syncs schema objects it knows about (tables, columns, constraints,
  // indexes, enums) from the Drizzle schema. Custom migrations authored via
  // `drizzle-kit generate --custom` contain hand-written SQL (GRANTs, policies, functions,
  // partial indexes, REVOKEs, partitioning, triggers) — and push silently SKIPS those files.
  //
  // Since the repo has no `meta/_journal.json`, `drizzle-kit migrate` is not usable here.
  // Instead, we iterate sorted migration dirs and apply the files whose first non-empty line
  // starts with `--` (the convention for hand-written custom migrations — auto-generated
  // migrations begin directly with DDL like `CREATE TABLE` / `CREATE TYPE`).
  //
  // Duplicate-object errors (42P07, 42710, 42701, 42P06, 42P16, 42723) are tolerated per
  // statement: push may have already created some constraints/indexes that a custom
  // migration re-declares. Any other error is fatal.
  console.log('Applying custom SQL migrations...');
  await applyCustomMigrations(adminPool);

  // The targeted REVOKEs that narrow `GRANT ... ON ALL TABLES TO roviq_app`
  // for institutes / auth_events / billing tables live in the
  // `20260409000000_i18n-search-fn-and-revokes` custom migration. They are
  // applied by `applyCustomMigrations` above so production migrate paths
  // get the same security tightening as `db-reset`.

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

/** SQLSTATE codes indicating the target object already exists — safe to skip. */
const DUPLICATE_OBJECT_SQLSTATES = new Set([
  '42P07', // duplicate_table
  '42P06', // duplicate_schema
  '42P16', // invalid_table_definition (policy already exists, etc.)
  '42710', // duplicate_object (constraint, index, policy, role grant)
  '42701', // duplicate_column
  '42723', // duplicate_function
  '42712', // duplicate_alias
]);

/**
 * Iterate `libs/database/migrations/<timestamp>_<name>/migration.sql`, sorted by folder
 * name, and execute each file whose first non-empty line starts with `--` (convention for
 * hand-written custom migrations — auto-generated files begin directly with DDL).
 *
 * Statements are split respecting PostgreSQL dollar-quoting and executed inside a per-file
 * transaction with a SAVEPOINT per statement. Errors with SQLSTATE codes indicating
 * "object already exists" are tolerated (push may have already created the object).
 */
async function applyCustomMigrations(adminPool: Pool): Promise<void> {
  const migrationsDir = join(process.cwd(), 'libs/database/migrations');
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const client: PoolClient = await adminPool.connect();
  try {
    for (const dir of dirs) {
      const sqlPath = join(migrationsDir, dir, 'migration.sql');
      let raw: string;
      try {
        raw = readFileSync(sqlPath, 'utf8');
      } catch {
        continue;
      }

      const firstNonEmpty = raw
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      if (!firstNonEmpty?.startsWith('--')) {
        // Auto-generated drizzle-kit migration — already applied by drizzle-kit push.
        continue;
      }

      const statements = splitSqlStatements(raw);
      if (statements.length === 0) continue;

      console.log(`  -> ${dir} (${statements.length} statements)`);
      await client.query('BEGIN');
      try {
        for (const stmt of statements) {
          await client.query('SAVEPOINT stmt');
          try {
            await client.query(stmt);
            await client.query('RELEASE SAVEPOINT stmt');
          } catch (err) {
            const code = (err as { code?: string }).code;
            if (code && DUPLICATE_OBJECT_SQLSTATES.has(code)) {
              await client.query('ROLLBACK TO SAVEPOINT stmt');
              await client.query('RELEASE SAVEPOINT stmt');
              continue;
            }
            throw err;
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Custom migration failed: ${dir}`);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

/** Parser state for splitSqlStatements — mutable cursor + accumulator. */
interface SqlParserState {
  sqlText: string;
  pos: number;
  current: string;
}

/** Skip a line comment (-- ...\n) and append it to the current buffer. */
function skipLineComment(state: SqlParserState): void {
  const eol = state.sqlText.indexOf('\n', state.pos);
  if (eol === -1) {
    state.current += state.sqlText.slice(state.pos);
    state.pos = state.sqlText.length;
  } else {
    state.current += state.sqlText.slice(state.pos, eol + 1);
    state.pos = eol + 1;
  }
}

/** Skip a block comment and append it to the current buffer. */
function skipBlockComment(state: SqlParserState): void {
  const end = state.sqlText.indexOf('*/', state.pos + 2);
  if (end === -1) {
    state.current += state.sqlText.slice(state.pos);
    state.pos = state.sqlText.length;
  } else {
    state.current += state.sqlText.slice(state.pos, end + 2);
    state.pos = end + 2;
  }
}

/** Consume a single-quoted string literal (handling '' escapes). */
function consumeSingleQuotedString(state: SqlParserState): void {
  state.current += state.sqlText[state.pos]; // opening quote
  state.pos++;
  const n = state.sqlText.length;
  while (state.pos < n) {
    const c = state.sqlText[state.pos];
    state.current += c;
    state.pos++;
    if (c === "'") {
      if (state.sqlText[state.pos] === "'") {
        state.current += state.sqlText[state.pos];
        state.pos++;
        continue;
      }
      break;
    }
  }
}

/** Consume a dollar-quoted block ($$...$$ or $tag$...$tag$). Returns true if matched. */
function tryConsumeDollarQuote(state: SqlParserState): boolean {
  const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(state.sqlText.slice(state.pos));
  if (!tagMatch) return false;

  const openTag = tagMatch[0];
  state.current += openTag;
  state.pos += openTag.length;
  const closeIdx = state.sqlText.indexOf(openTag, state.pos);
  if (closeIdx === -1) {
    state.current += state.sqlText.slice(state.pos);
    state.pos = state.sqlText.length;
  } else {
    state.current += state.sqlText.slice(state.pos, closeIdx + openTag.length);
    state.pos = closeIdx + openTag.length;
  }
  return true;
}

/**
 * Split a PostgreSQL SQL script into individual statements.
 * Handles: line/block comments, single-quoted strings, dollar-quoted blocks
 * ($$...$$ and $tag$...$tag$) used by PL/pgSQL DO blocks and function bodies.
 */
function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  const state: SqlParserState = { sqlText, pos: 0, current: '' };
  const n = sqlText.length;

  while (state.pos < n) {
    const ch = sqlText[state.pos];
    const next = sqlText[state.pos + 1];

    if (ch === '-' && next === '-') {
      skipLineComment(state);
    } else if (ch === '/' && next === '*') {
      skipBlockComment(state);
    } else if (ch === "'") {
      consumeSingleQuotedString(state);
    } else if (ch === '$' && tryConsumeDollarQuote(state)) {
      // dollar-quoted block consumed by helper
    } else if (ch === ';') {
      const trimmed = state.current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      state.current = '';
      state.pos++;
    } else {
      state.current += ch;
      state.pos++;
    }
  }

  const tail = state.current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
