export abstract class AuditPartitionRepository {
  /**
   * Ensure monthly partitions of `audit_logs` exist for the current month
   * through `current + monthsAhead`. Idempotent — safe to call repeatedly.
   */
  abstract ensureMonthsAhead(monthsAhead: number): Promise<void>;
}
