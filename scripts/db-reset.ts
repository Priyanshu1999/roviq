/**
 * Reset the database: drop all tables/enums, re-push schema, optionally seed.
 * Dev convenience only — production deploys use `pnpm db:migrate` (which is
 * `drizzle-kit migrate`, applies both auto-generated and `--` custom
 * migrations natively in v3 folder layout).
 *
 * Usage:
 *   pnpm db:reset          — drop + push (dev database)
 *   pnpm db:reset --seed   — drop + push + seed
 *   pnpm db:reset --test   — target roviq_test database (for e2e); always seeds
 *
 * Safety: refuses to run when NODE_ENV=production.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import Redis from 'ioredis';
import { Pool, type PoolClient } from 'pg';
import { baselineMigrations } from './db-baseline';

if (process.env.NODE_ENV === 'production') {
  console.error('Cannot reset database in production.');
  process.exit(1);
}

// db-reset needs superuser (roviq) to drop/create tables — always MIGRATE URL.
const useTestDb = process.argv.includes('--test');
const connectionString = useTestDb
  ? process.env.DATABASE_URL_TEST_MIGRATE ||
    'postgresql://roviq:roviq_dev@localhost:5434/roviq_test'
  : process.env.DATABASE_URL_MIGRATE || 'postgresql://roviq:roviq_dev@localhost:5434/roviq';

// Test DB always seeds — integration tests reference seed IDs (SEED.INSTITUTE_1
// etc.) and a schema-only test DB silently breaks 16+ test files with cryptic
// FK errors. No valid scenario for an unseeded test DB.
const shouldSeed = process.argv.includes('--seed') || useTestDb;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  try {
    await dropEverything(db);
    await applyPrereq(pool);
    console.log('Database cleared.');

    // drizzle-kit push runs as a subprocess; its own connections are
    // independent of `pool`, so the parent pool stays open across this call.
    console.log('Pushing schema...');
    execSync('drizzle-kit push --force --config=drizzle.config.ts', {
      stdio: 'inherit',
      cwd: 'libs/database',
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        DATABASE_URL_MIGRATE: connectionString,
      },
    });

    console.log('Granting roles...');
    await applyRoleGrants(pool);
    await forceRlsOnAllTables(pool);
    await fixRoleInheritance(pool);

    // Custom migrations carry handwritten GRANTs, policies, functions, partial
    // indexes, REVOKEs, partitioning, triggers — everything `drizzle-kit push`
    // doesn't sync. Production deploys use `pnpm db:migrate` (drizzle-kit
    // migrate) which applies the same files natively in v3 folder layout.
    // Duplicate-object SQLSTATEs are tolerated per statement — push may have
    // pre-created some objects.
    console.log('Applying custom SQL migrations...');
    await applyCustomMigrations(pool);

    // Mark every migration as already-applied so a future `drizzle-kit migrate`
    // against this DB is a no-op and only picks up genuinely new files.
    console.log('Baselining drizzle.__drizzle_migrations...');
    const { inserted, skipped } = await baselineMigrations(pool);
    console.log(`  ${inserted} inserted, ${skipped} already present`);

    // Mirror the api-gateway boot/daily ensure so dev/e2e/integration DBs
    // survive month rollovers — see drizzle-database skill.
    console.log('Ensuring monthly partitions...');
    await ensureMonthlyPartitions(pool);
  } finally {
    await pool.end();
  }

  if (shouldSeed) {
    console.log('Seeding...');
    execSync('pnpm db:seed', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL_MIGRATE: connectionString },
    });
  }
  // The auth lockout cache (rate-limit on failed logins) lives in Redis,
  // not Postgres. Without flushing, repeated test runs accumulate failures
  // for the same username and the suite eventually trips ACCOUNT_LOCKED on
  // a clean DB. Production never resets, so this only runs for --test.
  if (useTestDb) {
    await flushTestRedis();
  }

  console.log('Done.');
}

async function flushTestRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.flushdb();
    console.log('Flushed Redis DB.');
  } catch (err) {
    console.warn(`Redis flush skipped (${(err as Error).message}) — lockout cache may persist.`);
  } finally {
    redis.disconnect();
  }
}

async function dropEverything(db: ReturnType<typeof drizzle>): Promise<void> {
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

  await db.execute(sql.raw('DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE'));
  await db.execute(sql.raw('DROP SCHEMA IF EXISTS "drizzle" CASCADE'));
}

// Roles, extensions, helper functions — must exist before drizzle-kit push
// creates tables/indexes that reference them. Single source of truth: the
// prereq migration file (also runs first when `drizzle-kit migrate` builds
// from scratch).
async function applyPrereq(pool: Pool): Promise<void> {
  const prereqSql = readFileSync(
    join(process.cwd(), 'libs/database/migrations/20260101000000_prereq/migration.sql'),
    'utf8',
  );
  // Use the raw pg pool (simple-query protocol) so multi-statement SQL with
  // PL/pgSQL `$$ … $$` blocks runs as one batch. Drizzle's `execute` uses
  // extended protocol which mangles multi-statement input — DO blocks and
  // CREATE FUNCTION never reach the server.
  await pool.query(prereqSql);
}

async function applyRoleGrants(pool: Pool): Promise<void> {
  await pool.query(`
    -- Pool role can assume all three app roles via SET LOCAL ROLE
    GRANT roviq_app TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
    GRANT roviq_reseller TO roviq_pooler WITH INHERIT FALSE, SET TRUE;
    GRANT roviq_admin TO roviq_pooler WITH INHERIT FALSE, SET TRUE;

    GRANT USAGE ON SCHEMA public TO roviq_pooler;
    GRANT USAGE ON SCHEMA public TO roviq_app;
    GRANT USAGE ON SCHEMA public TO roviq_reseller;
    GRANT USAGE ON SCHEMA public TO roviq_admin;

    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO roviq_reseller;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO roviq_admin;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_reseller;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO roviq_admin;

    -- Reseller-only tables may not exist in test DB
    DO $$ BEGIN
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'reseller_memberships') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON reseller_memberships TO roviq_reseller;
      END IF;
      IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'impersonation_sessions') THEN
        GRANT SELECT, INSERT, UPDATE ON impersonation_sessions TO roviq_reseller;
      END IF;
    END $$;
  `);
}

// db:push only ENABLEs RLS — never FORCEs it. Skip partition children:
// FORCE on parent propagates automatically.
async function forceRlsOnAllTables(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(`
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
  `);
  for (const { tablename } of rows) {
    await pool.query(`ALTER TABLE "${tablename}" FORCE ROW LEVEL SECURITY`);
  }
}

// Strip superuser inheritance that the Docker postgres image may have added —
// roviq_app/reseller must NOT inherit, and roviq_admin keeps SET access for
// withAdmin() but not INHERIT.
async function fixRoleInheritance(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_auth_members am
        JOIN pg_roles r ON r.oid = am.roleid
        JOIN pg_roles m ON m.oid = am.member
        WHERE m.rolname = 'roviq_app' AND r.rolname = 'roviq' AND am.inherit_option = true
      ) THEN
        REVOKE roviq FROM roviq_app;
        REVOKE roviq FROM roviq_reseller;
        REVOKE roviq FROM roviq_admin;
        GRANT roviq TO roviq_admin WITH INHERIT FALSE, SET TRUE;
      END IF;
    END $$;
  `);
}

// Add new time-RANGE partitioned tables here — see drizzle-database skill.
const PARTITIONED_TABLES = ['audit_logs'] as const;
const MONTHS_AHEAD = 6;

async function ensureMonthlyPartitions(pool: Pool): Promise<void> {
  for (const table of PARTITIONED_TABLES) {
    await pool.query(
      `SELECT ensure_monthly_partition($1::regclass, gs)
       FROM generate_series(
         date_trunc('month', NOW()),
         date_trunc('month', NOW()) + ($2 || ' months')::interval,
         interval '1 month'
       ) AS gs`,
      [table, MONTHS_AHEAD],
    );
  }
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
