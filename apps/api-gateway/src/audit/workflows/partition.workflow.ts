/**
 * Audit partition management workflow (ROV-77).
 *
 * Temporal cron schedule: 0 2 25 * * (2 AM on 25th of each month)
 * Task queue: audit-maintenance
 * Workflow ID: audit-partition-cron
 *
 * Sequence:
 * 1. createNextMonthPartition — creates next month's partition (idempotent)
 * 2. enforceRetention — detaches partitions older than retention period
 * 3. verifyPartitionHealth — confirms the new partition is attached
 *
 * NOTE: Requires @temporalio/workflow and @temporalio/activity packages.
 * Currently implemented as plain async functions that can be wrapped in
 * Temporal activities once the SDK is installed. The workflow orchestration
 * below documents the intended Temporal registration.
 *
 * Temporal registration (when SDK is installed):
 *
 * ```typescript
 * import { proxyActivities } from '@temporalio/workflow';
 *
 * const activities = proxyActivities<typeof import('./partition.activities')>({
 *   startToCloseTimeout: '5 minutes',
 *   retry: { maximumAttempts: 3, initialInterval: '5 minutes' },
 * });
 *
 * export async function auditPartitionManagement(): Promise<void> {
 *   const partitionName = await activities.createNextMonthPartition();
 *   await activities.enforceRetention();
 *   await activities.verifyPartitionHealth(partitionName);
 * }
 * ```
 *
 * Worker registration:
 *
 * ```typescript
 * const worker = await Worker.create({
 *   workflowsPath: require.resolve('./partition.workflow'),
 *   activities,
 *   taskQueue: 'audit-maintenance',
 * });
 *
 * await client.workflow.start(auditPartitionManagement, {
 *   taskQueue: 'audit-maintenance',
 *   workflowId: 'audit-partition-cron',
 *   cronSchedule: '0 2 25 * *',
 * });
 * ```
 */

import type { DrizzleDB } from '@roviq/database';
import {
  createNextMonthPartition,
  enforceRetention,
  verifyPartitionHealth,
} from './partition.activities';

/**
 * Run the full partition management sequence.
 * Can be called directly (e.g., via NestJS cron) or wrapped in a Temporal workflow.
 */
export async function runPartitionManagement(db: DrizzleDB): Promise<{
  partitionCreated: string;
  partitionsDetached: string[];
  healthy: boolean;
}> {
  const partitionCreated = await createNextMonthPartition(db);
  const partitionsDetached = await enforceRetention(db);
  const healthy = await verifyPartitionHealth(db, partitionCreated);

  return { partitionCreated, partitionsDetached, healthy };
}
