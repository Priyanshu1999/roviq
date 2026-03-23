/**
 * Register billing Temporal cron schedules.
 *
 * Run once: npx ts-node ee/apps/api-gateway/src/billing/workflows/billing.schedule.ts
 *
 * Schedules:
 * - Subscription renewal: daily 00:00 UTC
 * - Trial expiry: daily 01:00 UTC
 * - Overdue check: daily 02:00 UTC
 */
import 'dotenv/config';
import { createLogger } from '@roviq/telemetry';
import { Client, Connection } from '@temporalio/client';

const logger = createLogger('billing-schedule');
const env = process.env;
const TEMPORAL_ADDRESS = env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
const TASK_QUEUE = 'billing-automation';

const SCHEDULES = [
  {
    id: 'billing-renewal-cron',
    workflow: 'subscriptionRenewalWorkflow',
    cron: env['BILLING_RENEWAL_CRON'] ?? '0 0 * * *',
    description: 'Daily subscription renewal + grace period check',
  },
  {
    id: 'billing-trial-expiry-cron',
    workflow: 'trialExpiryWorkflow',
    cron: env['BILLING_TRIAL_CRON'] ?? '0 1 * * *',
    description: 'Daily trial expiry + reminders',
  },
  {
    id: 'billing-overdue-cron',
    workflow: 'overdueInvoiceCheckWorkflow',
    cron: env['BILLING_OVERDUE_CRON'] ?? '0 2 * * *',
    description: 'Daily overdue invoice check',
  },
];

async function register() {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  for (const sched of SCHEDULES) {
    try {
      const handle = client.schedule.getHandle(sched.id);
      const desc = await handle.describe();
      logger.info(`Schedule ${sched.id} already exists (next: ${desc.info.nextActionTimes[0]})`);
    } catch {
      await client.schedule.create({
        scheduleId: sched.id,
        spec: { cronExpressions: [sched.cron] },
        action: {
          type: 'startWorkflow',
          workflowType: sched.workflow,
          taskQueue: TASK_QUEUE,
          workflowId: `${sched.id}-${Date.now()}`,
        },
        memo: { description: sched.description },
      });
      logger.info(`Created schedule: ${sched.id} (${sched.cron})`);
    }
  }

  await connection.close();
}

register().catch((err) => {
  logger.error('Failed to register billing schedules', err);
  process.exit(1);
});
