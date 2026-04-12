/**
 * NestJS-based billing Temporal worker.
 *
 * Registers billing automation workflows on the 'billing-automation' task queue.
 * Uses ConfigService for all env access.
 */
import path from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import { createDrizzleForWorker } from './worker-db';

const TASK_QUEUE = 'billing-automation';

@Injectable()
export class BillingWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BillingWorkerService.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    // Only start worker if explicitly enabled (avoids running in every API instance)
    if (this.config.get<string>('BILLING_WORKER_ENABLED') !== 'true') return;

    this.startWorker().catch((err) => {
      this.logger.error('Billing worker failed to start', (err as Error).message);
    });
  }

  private async startWorker(): Promise<void> {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const dbUrl = this.config.get<string>(
      'DATABASE_URL_MIGRATE',
      'postgresql://roviq:roviq_dev@localhost:5432/roviq',
    );
    const connection = await NativeConnection.connect({ address });
    const db = await createDrizzleForWorker(dbUrl);

    const { createBillingActivities } = await import('./billing.activities.js');
    const activities = createBillingActivities(db);

    const worker = await Worker.create({
      connection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, './'),
      activities,
    });

    this.logger.log(`Billing worker started on queue: ${TASK_QUEUE}`);
    await worker.run();
  }
}
