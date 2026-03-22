/**
 * Partition management helpers — date calculations and naming.
 * Pure functions with no external dependencies (testable in isolation).
 */

/**
 * Get the first day of the next month from the given date.
 * Handles year rollover (December → January of next year).
 *
 * @example getNextMonthStart(new Date('2026-03-25')) → 2026-04-01T00:00:00.000Z
 * @example getNextMonthStart(new Date('2026-12-25')) → 2027-01-01T00:00:00.000Z
 */
export function getNextMonthStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

/**
 * Get the first day of the month after next from the given date.
 * Used as the upper bound of a partition range.
 *
 * @example getMonthAfterNextStart(new Date('2026-03-25')) → 2026-05-01T00:00:00.000Z
 */
export function getMonthAfterNextStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 2, 1));
}

/**
 * Generate the partition table name for a given month.
 * Format: audit_logs_YYYY_MM
 *
 * @example getPartitionName(new Date('2026-04-01')) → 'audit_logs_2026_04'
 * @example getPartitionName(new Date('2027-01-01')) → 'audit_logs_2027_01'
 */
export function getPartitionName(monthStart: Date): string {
  const year = monthStart.getUTCFullYear();
  const month = String(monthStart.getUTCMonth() + 1).padStart(2, '0');
  return `audit_logs_${year}_${month}`;
}

/**
 * Calculate the retention cutoff date based on retention days.
 * Any partition entirely before this date can be detached.
 *
 * @example getRetentionCutoff(new Date('2026-03-25'), 365) → ~2025-03-25
 */
export function getRetentionCutoff(from: Date, retentionDays: number): Date {
  const cutoff = new Date(from);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  // Round down to first of month — only detach complete months
  return new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1));
}

/**
 * Parse a partition name to extract its month start date.
 * Returns null if the name doesn't match the expected format.
 *
 * @example parsePartitionDate('audit_logs_2025_02') → 2025-02-01T00:00:00.000Z
 */
export function parsePartitionDate(partitionName: string): Date | null {
  const match = partitionName.match(/^audit_logs_(\d{4})_(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1; // 0-indexed
  return new Date(Date.UTC(year, month, 1));
}
