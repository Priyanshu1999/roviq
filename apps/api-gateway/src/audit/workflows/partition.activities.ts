import { Logger } from '@nestjs/common';
import { type DrizzleDB, withAdmin } from '@roviq/database';
import { sql } from 'drizzle-orm';
import {
  getMonthAfterNextStart,
  getNextMonthStart,
  getPartitionName,
  getRetentionCutoff,
  parsePartitionDate,
} from './partition.helpers';

const logger = new Logger('AuditPartitionActivities');

/** Default retention: 1 year (per-tenant tier retention deferred to billing) */
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Activity 1: Create next month's partition.
 * Idempotent — IF NOT EXISTS prevents failures on re-run.
 * Runs via withAdmin since partition DDL requires roviq_admin.
 */
export async function createNextMonthPartition(db: DrizzleDB): Promise<string> {
  const now = new Date();
  const nextMonth = getNextMonthStart(now);
  const monthAfter = getMonthAfterNextStart(now);
  const partitionName = getPartitionName(nextMonth);

  return withAdmin(db, async (tx) => {
    // IF NOT EXISTS via raw SQL — drizzle-orm doesn't have DDL helpers for partitions
    await tx.execute(
      sql.raw(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF audit_logs
        FOR VALUES FROM ('${nextMonth.toISOString()}') TO ('${monthAfter.toISOString()}')
      `),
    );

    logger.log(`Partition ${partitionName} created (or already exists)`);
    return partitionName;
  });
}

/**
 * Activity 2: Enforce retention by detaching old partitions.
 * Detaches (does NOT drop) — allows recovery if needed.
 * Uses global retention period for v1 (per-tenant deferred to billing tiers).
 */
export async function enforceRetention(
  db: DrizzleDB,
  retentionDays = DEFAULT_RETENTION_DAYS,
): Promise<string[]> {
  const cutoff = getRetentionCutoff(new Date(), retentionDays);

  return withAdmin(db, async (tx) => {
    // List all attached partitions
    const partitions = await tx.execute<{ partition_name: string }>(
      sql`SELECT inhrelid::regclass::text AS partition_name
          FROM pg_inherits
          WHERE inhparent = 'audit_logs'::regclass
          ORDER BY inhrelid::regclass::text`,
    );

    const detached: string[] = [];

    for (const row of partitions.rows) {
      const partitionDate = parsePartitionDate(row.partition_name);
      if (!partitionDate) continue;

      // Only detach partitions that end entirely before the cutoff
      const partitionEnd = new Date(
        Date.UTC(partitionDate.getUTCFullYear(), partitionDate.getUTCMonth() + 1, 1),
      );

      if (partitionEnd <= cutoff) {
        await tx.execute(
          sql.raw(`ALTER TABLE audit_logs DETACH PARTITION ${row.partition_name}`),
        );
        detached.push(row.partition_name);
        logger.log(`Detached partition ${row.partition_name} (ended ${partitionEnd.toISOString()}, cutoff ${cutoff.toISOString()})`);
      }
    }

    return detached;
  });
}

/**
 * Activity 3: Verify partition health.
 * Lists all attached partitions and confirms the expected one exists.
 */
export async function verifyPartitionHealth(
  db: DrizzleDB,
  expectedPartition: string,
): Promise<boolean> {
  return withAdmin(db, async (tx) => {
    const partitions = await tx.execute<{ partition_name: string }>(
      sql`SELECT inhrelid::regclass::text AS partition_name
          FROM pg_inherits
          WHERE inhparent = 'audit_logs'::regclass
          ORDER BY inhrelid::regclass::text`,
    );

    const names = partitions.rows.map((r) => r.partition_name);
    const found = names.includes(expectedPartition);

    if (found) {
      logger.log(`Partition health OK: ${expectedPartition} is attached (${names.length} total)`);
    } else {
      logger.error(`Partition health FAILED: ${expectedPartition} not found in [${names.join(', ')}]`);
    }

    return found;
  });
}
