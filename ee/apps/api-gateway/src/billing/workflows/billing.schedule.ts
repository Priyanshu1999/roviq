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
/**
 * NestJS-based billing Temporal schedule registration.
 *
 * Registers cron schedules for billing automation workflows.
 * Uses ConfigService for all env access.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';

const TASK_QUEUE = 'billing-automation';

@Injectable()
export class BillingScheduleService {
  private readonly logger = new Logger(BillingScheduleService.name);

  constructor(private readonly config: ConfigService) {}

  async register(): Promise<void> {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });

    const schedules = [
      {
        id: 'billing-renewal-cron',
        workflow: 'subscriptionRenewalWorkflow',
        cron: this.config.get<string>('BILLING_RENEWAL_CRON', '0 0 * * *'),
        description: 'Daily subscription renewal + grace period check',
      },
      {
        id: 'billing-trial-expiry-cron',
        workflow: 'trialExpiryWorkflow',
        cron: this.config.get<string>('BILLING_TRIAL_CRON', '0 1 * * *'),
        description: 'Daily trial expiry + reminders',
      },
      {
        id: 'billing-overdue-cron',
        workflow: 'overdueInvoiceCheckWorkflow',
        cron: this.config.get<string>('BILLING_OVERDUE_CRON', '0 2 * * *'),
        description: 'Daily overdue invoice check',
      },
      {
        id: 'billing-upi-expiry-cron',
        workflow: 'upiVerificationExpiryWorkflow',
        cron: this.config.get<string>('BILLING_UPI_EXPIRY_CRON', '0 3 * * *'),
        description: 'Daily UPI P2P verification expiry check',
      },
    ];

    for (const sched of schedules) {
      try {
        const handle = client.schedule.getHandle(sched.id);
        const desc = await handle.describe();
        this.logger.log(
          `Schedule ${sched.id} already exists (next: ${desc.info.nextActionTimes[0]})`,
        );
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
        this.logger.log(`Created schedule: ${sched.id} (${sched.cron})`);
      }
    }

    await connection.close();
  }
}
