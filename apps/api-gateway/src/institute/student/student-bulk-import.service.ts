/**
 * Service for bulk student import operations (ROV-155).
 *
 * Starts Temporal workflows and queries their progress.
 * Does NOT contain business logic — that lives in the Temporal activities.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import type {
  BulkImportProgress,
  BulkStudentImportResult,
} from './workflows/bulk-student-import.types';

const TASK_QUEUE = 'student-bulk-import';

@Injectable()
export class StudentBulkImportService {
  private readonly logger = new Logger(StudentBulkImportService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Start a BulkStudentImportWorkflow and return its workflow ID.
   * The caller uses the workflow ID to poll for progress.
   */
  async startBulkImport(input: {
    tenantId: string;
    fileUrl: string;
    academicYearId: string;
    standardId: string;
    sectionId: string;
    createdBy: string;
    fieldMapping: Record<string, string>;
  }): Promise<string> {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });

    const workflowId = `bulk-student-import-${input.tenantId}-${Date.now()}`;

    await client.workflow.start('BulkStudentImportWorkflow', {
      taskQueue: TASK_QUEUE,
      workflowId,
      workflowExecutionTimeout: '10 minutes',
      args: [input],
    });

    this.logger.log(`Started bulk import workflow: ${workflowId}`);
    await connection.close();

    return workflowId;
  }

  /**
   * Query the progress of a running or completed bulk import workflow.
   * Uses the Temporal query API to read the workflow's progress state.
   */
  async getProgress(workflowId: string): Promise<BulkImportProgress> {
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });

    try {
      const handle = client.workflow.getHandle(workflowId);

      // Try query first (works while workflow is running)
      try {
        const progress = await handle.query<BulkImportProgress>('bulkImportProgress');
        return progress;
      } catch {
        // Query failed — workflow may have completed. Check result.
        const description = await handle.describe();

        if (description.status.name === 'COMPLETED') {
          const result = (await handle.result()) as BulkStudentImportResult;
          return {
            status: 'completed',
            totalRows: result.totalRows,
            processed: result.totalRows,
            created: result.created,
            skipped: result.skipped,
            errorCount: result.errorCount,
            reportUrl: result.reportUrl,
          };
        }

        if (description.status.name === 'FAILED') {
          return {
            status: 'failed',
            totalRows: 0,
            processed: 0,
            created: 0,
            skipped: 0,
            errorCount: 0,
            reportUrl: null,
          };
        }

        // Still running but query not yet available
        return {
          status: 'parsing',
          totalRows: 0,
          processed: 0,
          created: 0,
          skipped: 0,
          errorCount: 0,
          reportUrl: null,
        };
      }
    } finally {
      await connection.close();
    }
  }
}
