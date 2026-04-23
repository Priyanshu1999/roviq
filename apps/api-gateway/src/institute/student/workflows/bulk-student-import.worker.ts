/**
 * NestJS-based Temporal worker for student bulk import.
 *
 * Registers the BulkStudentImportWorkflow and its activities
 * on the 'student-bulk-import' task queue.
 *
 * Follows the same pattern as BillingWorkerService (ee/billing/workflows/billing.worker.ts).
 * Uses ConfigService for all env access.
 */
import path from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import { IdentityService } from '../../../auth/identity.service';
import { createDrizzleForWorker } from './worker-db';

const TASK_QUEUE = 'student-bulk-import';

@Injectable()
export class BulkStudentImportWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BulkStudentImportWorkerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly identityService: IdentityService,
  ) {}

  async onModuleInit() {
    // Only start worker if explicitly enabled (avoids running in every API instance)
    if (this.config.get<string>('STUDENT_IMPORT_WORKER_ENABLED') !== 'true') return;

    this.startWorker().catch((err) => {
      this.logger.error('Student import worker failed to start', (err as Error).message);
    });
  }

  private async startWorker(): Promise<void> {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const dbUrl = this.config.get<string>(
      'DATABASE_URL_MIGRATE',
      'postgresql://roviq:roviq_dev@localhost:5434/roviq',
    );
    const connection = await NativeConnection.connect({ address });
    const db = await createDrizzleForWorker(dbUrl);

    const { createBulkStudentImportActivities } = await import(
      './bulk-student-import.activities.js'
    );
    // NATS client passed as null — student.admitted events still pending wiring;
    // IdentityService owns user creation and emits NOTIFICATION.user.created internally.
    const activities = createBulkStudentImportActivities(db, null, this.identityService);

    const worker = await Worker.create({
      connection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, './'),
      activities,
    });

    this.logger.log(`Student import worker started on queue: ${TASK_QUEUE}`);
    await worker.run();
  }
}
