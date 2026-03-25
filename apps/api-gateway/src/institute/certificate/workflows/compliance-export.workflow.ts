/**
 * ComplianceExportWorkflow — Temporal workflow (ROV-171).
 *
 * Generates a compliance report (UDISE+, CBSE, RTE, TC register, AWR)
 * as a single activity, uploads to S3, notifies admin.
 *
 * Task queue: compliance-export
 */
import { proxyActivities } from '@temporalio/workflow';
import type {
  ComplianceExportActivities,
  ComplianceExportInput,
  ComplianceExportResult,
} from './compliance-export.types';

const activities = proxyActivities<ComplianceExportActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds',
    backoffCoefficient: 2,
  },
});

export async function ComplianceExportWorkflow(
  input: ComplianceExportInput,
): Promise<ComplianceExportResult> {
  return activities.generateReport(input);
}
