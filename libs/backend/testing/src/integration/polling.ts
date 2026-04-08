import type { Pool, PoolClient } from 'pg';

/**
 * Poll a condition function until it returns true or the timeout elapses.
 *
 * Used to assert async side effects — NATS consumers, queue workers, scheduled
 * jobs — without resorting to fixed `setTimeout()` delays. Throws on timeout
 * with a descriptive error so the test failure points at the missing condition.
 */
export async function waitForCondition(
  fn: () => Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number; description?: string } = {},
): Promise<void> {
  const { timeoutMs = 5_000, intervalMs = 100, description } = options;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const label = description ? ` (${description})` : '';
  throw new Error(`waitForCondition timed out after ${timeoutMs}ms${label}`);
}

export interface AuditLogQuery {
  /** Action name written by the audit interceptor (e.g., `createSection`). */
  action: string;
  /** Restrict to a specific tenant. Omit for cross-tenant assertions. */
  tenantId?: string;
  /** Restrict to a specific entity ID. */
  entityId?: string;
  timeoutMs?: number;
}

// Narrow row shape with the columns this helper touches. We import the schema
// only lazily via the caller's asserted fields to avoid a hard dependency on
// the full schema barrel; a structured type here is better than
// `[key: string]: unknown` because it catches typos at usage sites.
export interface AuditLogRow {
  id: string;
  action: string;
  tenant_id: string | null;
  entity_id: string | null;
  entity_type: string | null;
  action_type: string | null;
  actor_id: string | null;
  created_at: Date;
}

/**
 * Poll the `audit_logs` table for entries matching the given criteria.
 *
 * Holds a SINGLE pooled connection for the lifetime of the poll instead of
 * acquiring + releasing once per iteration. The connection runs as
 * `roviq_admin` inside a long-lived transaction (`SET LOCAL ROLE` requires a
 * tx), which is rolled back at the end so the helper leaves no trace in the
 * DB regardless of whether the row was found.
 */
export async function waitForAuditLog(pool: Pool, query: AuditLogQuery): Promise<AuditLogRow[]> {
  const { action, tenantId, entityId, timeoutMs = 5_000 } = query;

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE roviq_admin');

    const conditions: string[] = ['action = $1'];
    const params: unknown[] = [action];
    if (tenantId) {
      conditions.push(`tenant_id = $${params.length + 1}`);
      params.push(tenantId);
    }
    if (entityId) {
      conditions.push(`entity_id = $${params.length + 1}`);
      params.push(entityId);
    }
    const sql = `SELECT * FROM audit_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;

    let rows: AuditLogRow[] = [];
    await waitForCondition(
      async () => {
        const result = await client.query(sql, params);
        rows = result.rows as AuditLogRow[];
        return rows.length > 0;
      },
      { timeoutMs, description: `audit_logs row for action=${action}` },
    );
    return rows;
  } finally {
    // Always roll back: SELECTs have no lasting effect but `SET LOCAL ROLE`
    // persists for the duration of the transaction, so we want a clean state.
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}
