/**
 * Register the audit partition management cron schedule with Temporal.
 *
 * Run once: npx ts-node apps/api-gateway/src/audit/workflows/partition.schedule.ts
 *
 * Schedule: 25th of each month at 2 AM UTC
 * Creates next month's partition 5 days early as safety margin.
 */
import 'dotenv/config';
import { Client, Connection } from '@temporalio/client';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'audit-maintenance';
const SCHEDULE_ID = 'audit-partition-cron';

async function register() {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  try {
    // Check if schedule already exists
    const handle = client.schedule.getHandle(SCHEDULE_ID);
    const desc = await handle.describe();
    console.log(
      `Schedule ${SCHEDULE_ID} already exists (next run: ${desc.info.nextActionTimes[0]})`,
    );
    return;
  } catch {
    // Schedule doesn't exist — create it
  }

  await client.schedule.create({
    scheduleId: SCHEDULE_ID,
    spec: {
      /** 2 AM UTC on the 25th of each month */
      calendars: [{ hour: 2, minute: 0, dayOfMonth: 25 }],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'auditPartitionManagement',
      taskQueue: TASK_QUEUE,
    },
    policies: {
      /** Skip if previous run hasn't finished */
      overlap: 'SKIP',
      /** Catch up missed runs within 24 hours */
      catchupWindow: '24 hours',
    },
  });

  console.log(`Schedule ${SCHEDULE_ID} created: 2 AM UTC on 25th of each month`);
  await connection.close();
}

register().catch((err) => {
  console.error('Failed to register schedule:', err);
  process.exit(1);
});
