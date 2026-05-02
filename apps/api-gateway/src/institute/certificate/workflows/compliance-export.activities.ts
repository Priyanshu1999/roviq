/**
 * Activities for ComplianceExportWorkflow (ROV-171).
 *
 * Dispatches to the appropriate export generator based on reportType,
 * uploads the result to S3 (stub), and emits notification event.
 */
import { Logger } from '@nestjs/common';
import type { DrizzleDB } from '@roviq/database';
import { EVENT_PATTERNS, type EventPattern } from '@roviq/nats-jetstream';
import {
  generateAwrExport,
  generateCbseLocExport,
  generateCbseRegistrationExport,
  generateRteReport,
  generateTcRegisterExport,
  generateUdiseDcfExport,
} from '../exports';
import type {
  ComplianceExportActivities,
  ComplianceExportInput,
  ComplianceExportResult,
} from './compliance-export.types';

const logger = new Logger('ComplianceExportActivities');

interface NatsEmitter {
  emit(
    pattern: string,
    data: unknown,
  ): { subscribe: (opts: { error?: (err: unknown) => void }) => void };
}

export function createComplianceExportActivities(
  db: DrizzleDB,
  natsClient: NatsEmitter | null,
): ComplianceExportActivities {
  function emitEvent(pattern: EventPattern, data: unknown): void {
    if (!natsClient) return;
    natsClient.emit(pattern, data).subscribe({
      error: (err) => logger.warn(`Failed to emit ${pattern}: ${err}`),
    });
  }

  return {
    async generateReport(input: ComplianceExportInput): Promise<ComplianceExportResult> {
      const { tenantId, reportType, academicYearId, requestedBy } = input;
      logger.log(`Generating ${reportType} export for tenant ${tenantId}`);

      let buffer: Buffer;

      switch (reportType) {
        case 'udise_dcf':
          buffer = await generateUdiseDcfExport(db, tenantId, academicYearId);
          break;
        case 'cbse_registration':
          buffer = await generateCbseRegistrationExport(db, tenantId, academicYearId);
          break;
        case 'cbse_loc':
          buffer = await generateCbseLocExport(db, tenantId, academicYearId);
          break;
        case 'rte_report':
          buffer = await generateRteReport(db, tenantId, academicYearId);
          break;
        case 'tc_register':
          buffer = await generateTcRegisterExport(db, tenantId, academicYearId);
          break;
        case 'awr':
          buffer = await generateAwrExport(db, tenantId, academicYearId);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      // Upload to S3 (stub)
      const fileKey = `exports/${tenantId}/${reportType}-${academicYearId}-${Date.now()}.xlsx`;
      const fileUrl = `/api/storage/${fileKey}`;
      logger.log(`[STUB] Would upload ${buffer.length} bytes to S3: ${fileKey}`);

      // Notify admin
      emitEvent(EVENT_PATTERNS.EXPORT.completed, {
        tenantId,
        reportType,
        fileUrl,
        requestedBy,
      });

      logger.log(`${reportType} export complete: ${buffer.length} bytes`);

      return {
        reportType,
        fileUrl,
        fileSize: buffer.length,
        rowCount: 0, // TODO: Return actual row count from generators
      };
    },
  };
}
