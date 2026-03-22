/**
 * Temporal worker for audit partition management.
 *
 * Registers the auditPartitionManagement workflow and partition activities
 * on the 'audit-maintenance' task queue.
 *
 * Run: npx ts-node apps/api-gateway/src/audit/workflows/partition.worker.ts
 * Or integrate into the NestJS bootstrap lifecycle.
 */
import 'dotenv/config';
import { createDrizzleDb } from '@roviq/database';
import { NativeConnection, Worker } from '@temporalio/worker';
import { Pool } from 'pg';
import { createPartitionActivities } from './partition.activities';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const DATABASE_URL_MIGRATE =
  process.env.DATABASE_URL_MIGRATE ?? 'postgresql://roviq:roviq_dev@localhost:5432/roviq';
const TASK_QUEUE = 'audit-maintenance';

async function run() {
  // DB connection for activities (superuser — partition DDL requires it)
  const pool = new Pool({ connectionString: DATABASE_URL_MIGRATE, max: 3 });
  const db = createDrizzleDb(pool);

  // Bind activities to the DB instance
  const activities = createPartitionActivities(db);

  // Connect to Temporal server
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./partition.workflow'),
    activities,
  });

  // Worker runs until shutdown signal
  await worker.run();

  // Cleanup
  await pool.end();
}

run().catch((err) => {
  console.error('Temporal worker failed:', err);
  process.exit(1);
});
