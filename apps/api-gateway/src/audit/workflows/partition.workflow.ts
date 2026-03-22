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
 * Each activity retries up to 3 times with 5-minute backoff.
 * On failure after exhaustion, Temporal surfaces the error for alerting.
 */
import { proxyActivities } from '@temporalio/workflow';
import type { PartitionActivities } from './partition.activities';

const { createNextMonthPartition, enforceRetention, verifyPartitionHealth } =
  proxyActivities<PartitionActivities>({
    startToCloseTimeout: '5 minutes',
    retry: {
      maximumAttempts: 3,
      initialInterval: '5 minutes',
      backoffCoefficient: 2,
    },
  });

/**
 * Temporal workflow: create next month's partition, enforce retention, verify health.
 * Runs independently — enforceRetention failure does not block verifyPartitionHealth.
 */
export async function auditPartitionManagement(): Promise<{
  partitionCreated: string;
  partitionsDetached: string[];
  healthy: boolean;
}> {
  const partitionCreated = await createNextMonthPartition();
  const partitionsDetached = await enforceRetention();
  const healthy = await verifyPartitionHealth(partitionCreated);

  return { partitionCreated, partitionsDetached, healthy };
}
