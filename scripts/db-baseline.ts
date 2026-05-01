/**
 * Mark every existing migration as already-applied in `drizzle.__drizzle_migrations`
 * — for DBs originally built via `drizzle-kit push` that need to switch to
 * `drizzle-kit migrate`. Idempotent. New DBs do not need this.
 */
import 'dotenv/config';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Pool } from 'pg';

export async function baselineMigrations(
  pool: Pool,
): Promise<{ inserted: number; skipped: number }> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  // Reuse drizzle-orm's own folder reader so hash + timestamp match what
  // `drizzle-kit migrate` would write — no drift if drizzle changes either.
  const migrations = readMigrationFiles({ migrationsFolder: 'libs/database/migrations' });
  const { rows } = await pool.query<{ hash: string }>(
    'SELECT hash FROM drizzle.__drizzle_migrations',
  );
  const seen = new Set(rows.map((r) => r.hash));

  let inserted = 0;
  let skipped = 0;
  for (const m of migrations) {
    if (seen.has(m.hash)) {
      skipped += 1;
      continue;
    }
    await pool.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [m.hash, m.folderMillis],
    );
    inserted += 1;
  }
  return { inserted, skipped };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('Define DATABASE_URL_MIGRATE or DATABASE_URL.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    const { inserted, skipped } = await baselineMigrations(pool);
    console.log(`Baseline: ${inserted} inserted, ${skipped} already present.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
