/**
 * BulkStudentImportWorkflow — Temporal workflow (ROV-155, PRD §7.1).
 *
 * Orchestrates CSV-based bulk student import:
 *   Step 1: Parse CSV (download from MinIO, detect encoding, validate rows)
 *   Step 2: Batch insert (50 rows per activity, with retry)
 *   Step 3: Generate report (error CSV uploaded to MinIO)
 *
 * Task queue: student-bulk-import
 * Workflow timeout: 10 minutes
 */
import { defineQuery, proxyActivities, setHandler } from '@temporalio/workflow';
import type {
  BulkImportProgress,
  BulkStudentImportActivities,
  BulkStudentImportInput,
  BulkStudentImportResult,
  RowError,
} from './bulk-student-import.types';

/** Batch size — 50 rows per Temporal activity (ROV-155 spec) */
const BATCH_SIZE = 50;

const activities = proxyActivities<BulkStudentImportActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
});

/** Query to check import progress without waiting for completion */
export const bulkImportProgressQuery = defineQuery<BulkImportProgress>('bulkImportProgress');

export async function BulkStudentImportWorkflow(
  input: BulkStudentImportInput,
): Promise<BulkStudentImportResult> {
  const { tenantId, fileUrl, academicYearId, standardId, sectionId, createdBy, fieldMapping } =
    input;

  // ── Mutable progress state (queryable) ─────────────────
  let progress: BulkImportProgress = {
    status: 'parsing',
    totalRows: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    errorCount: 0,
    reportUrl: null,
  };

  setHandler(bulkImportProgressQuery, () => progress);

  // ── Step 1: Parse CSV ──────────────────────────────────
  progress = { ...progress, status: 'parsing' };

  const parseResult = await activities.parseCsv(fileUrl, fieldMapping);
  const allErrors: RowError[] = [...parseResult.errors];

  progress = {
    ...progress,
    status: 'validating',
    totalRows: parseResult.totalRows,
    errorCount: allErrors.length,
  };

  // ── Step 2: Batch insert ───────────────────────────────
  progress = { ...progress, status: 'inserting' };

  const { validRows } = parseResult;
  let totalCreated = 0;
  let totalSkipped = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    const batchResult = await activities.insertBatch(
      tenantId,
      academicYearId,
      standardId,
      sectionId,
      createdBy,
      batch,
    );

    totalCreated += batchResult.created;
    totalSkipped += batchResult.skipped;
    allErrors.push(...batchResult.errors);

    progress = {
      ...progress,
      processed: Math.min(i + BATCH_SIZE, validRows.length),
      created: totalCreated,
      skipped: totalSkipped,
      errorCount: allErrors.length,
    };
  }

  // ── Step 3: Generate report ────────────────────────────
  let reportUrl: string | null = null;

  if (allErrors.length > 0) {
    progress = { ...progress, status: 'generating_report' };

    const reportResult = await activities.generateReport(
      tenantId,
      allErrors,
      parseResult.totalRows,
      totalCreated,
      totalSkipped,
    );
    reportUrl = reportResult.reportUrl;
  }

  // ── Complete ───────────────────────────────────────────
  progress = {
    status: 'completed',
    totalRows: parseResult.totalRows,
    processed: validRows.length,
    created: totalCreated,
    skipped: totalSkipped,
    errorCount: allErrors.length,
    reportUrl,
  };

  return {
    status: 'completed',
    totalRows: parseResult.totalRows,
    created: totalCreated,
    skipped: totalSkipped,
    errorCount: allErrors.length,
    errors: allErrors,
    reportUrl,
  };
}
