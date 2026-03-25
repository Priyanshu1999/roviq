import { createDrizzleDb, type DrizzleDB } from '@roviq/database';
import { Pool } from 'pg';

/** Create a standalone DrizzleDB for the Temporal worker (not NestJS DI) */
export async function createDrizzleForWorker(connectionString: string): Promise<DrizzleDB> {
  const pool = new Pool({ connectionString, max: 3 });
  return createDrizzleDb(pool);
}
