/**
 * Temporal worker for billing automation workflows.
 *
 * Task queue: billing-automation
 * Registers: subscriptionRenewalWorkflow, trialExpiryWorkflow,
 *            overdueInvoiceCheckWorkflow, resellerDeletionCleanupWorkflow
 */
import 'dotenv/config';
import path from 'node:path';
import { createLogger } from '@roviq/telemetry';
import { NativeConnection, Worker } from '@temporalio/worker';
import { createDrizzleForWorker } from './worker-db';

const logger = createLogger('billing-worker');
const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
const TASK_QUEUE = 'billing-automation';

async function main() {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  const db = await createDrizzleForWorker();

  // Import activities dynamically to bind DB instance
  const { createBillingActivities } = await import('./billing.activities');
  const activities = createBillingActivities(db);

  const worker = await Worker.create({
    connection,
    taskQueue: TASK_QUEUE,
    workflowsPath: path.resolve(__dirname, './'),
    activities,
  });

  logger.info(`Billing worker started on queue: ${TASK_QUEUE}`);
  await worker.run();
}

main().catch((err) => {
  logger.error('Billing worker failed', err);
  process.exit(1);
});
