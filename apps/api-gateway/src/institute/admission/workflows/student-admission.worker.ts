/**
 * NestJS-based Temporal worker for StudentAdmissionWorkflow (ROV-159).
 *
 * Registers the workflow + its activities on the `student-admission`
 * task queue. Without this worker the `approveApplication` mutation starts
 * a workflow that never runs, leaving applications stuck in `fee_paid`.
 *
 * Follows the same pattern as BulkStudentImportWorkerService. Enabled via
 * STUDENT_ADMISSION_WORKER_ENABLED=true so that only one API instance runs
 * the worker when the service is scaled horizontally.
 */
import path from 'node:path';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { NativeConnection, Worker } from '@temporalio/worker';
import { IdentityService } from '../../../auth/identity.service';
import { createDrizzleForWorker } from '../../student/workflows/worker-db';

const TASK_QUEUE = 'student-admission';

@Injectable()
export class StudentAdmissionWorkerService implements OnModuleInit {
  private readonly logger = new Logger(StudentAdmissionWorkerService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly identityService: IdentityService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('STUDENT_ADMISSION_WORKER_ENABLED') !== 'true') return;

    this.startWorker().catch((err) => {
      this.logger.error('Student admission worker failed to start', (err as Error).message);
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

    const { createStudentAdmissionActivities } = await import('./student-admission.activities.js');
    const activities = createStudentAdmissionActivities(db, this.natsClient, this.identityService);

    const worker = await Worker.create({
      connection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, './'),
      activities,
    });

    this.logger.log(`Student admission worker started on queue: ${TASK_QUEUE}`);
    await worker.run();
  }
}
