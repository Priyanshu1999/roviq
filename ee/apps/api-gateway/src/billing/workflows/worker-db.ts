import { createDrizzleDb, type DrizzleDB } from '@roviq/database';
import { Pool } from 'pg';

const DATABASE_URL_MIGRATE =
  process.env['DATABASE_URL_MIGRATE'] ?? 'postgresql://roviq:roviq_dev@localhost:5432/roviq';

/** Create a standalone DrizzleDB for the Temporal worker (not NestJS DI) */
export async function createDrizzleForWorker(): Promise<DrizzleDB> {
  const pool = new Pool({ connectionString: DATABASE_URL_MIGRATE, max: 3 });
  return createDrizzleDb(pool);
}
