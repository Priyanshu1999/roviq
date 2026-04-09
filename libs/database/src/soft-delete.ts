import { NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/request-context';
import { eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from './providers';

// Drizzle's PgTable generic doesn't expose column accessors — there is no typed way
// to write a generic utility that operates on "any table with id/deletedAt/deletedBy".
// The `as any` casts below are a Drizzle framework limitation, not a workaround.
// biome-ignore lint/suspicious/noExplicitAny: Drizzle PgTable doesn't expose column types generically
type TableRef = any;

function assertSoftDeletable(table: PgTable): void {
  const t = table as TableRef;
  if (!t.id || !t.deletedAt || !t.deletedBy) {
    throw new Error(
      `Table ${t._.name} is not soft-deletable (missing id, deletedAt, or deletedBy)`,
    );
  }
}

/**
 * Soft-delete a record by setting deletedAt/deletedBy.
 *
 * Soft delete is an UPDATE, not a DELETE — it never triggers foreign-key
 * violations. Earlier versions of this helper performed a "FK pre-check" by
 * issuing a real DELETE inside a savepoint and rolling back, on the
 * assumption that callers wanted a friendly "this row is referenced" error
 * before the soft-delete. That pre-check is unnecessary (soft-delete works
 * fine on referenced rows — that's the entire point of soft-delete) and
 * actively broken on PostgreSQL: `ROLLBACK TO SAVEPOINT` reverts every
 * `SET LOCAL ROLE` and `SET LOCAL` variable installed by the surrounding
 * `withTenant`/`withReseller`/`withTrash` wrapper, leaving the subsequent
 * UPDATE running with no role/tenant context and failing the RLS WITH
 * CHECK policy with "new row violates row-level security policy".
 *
 * **Visibility-after-update gotcha:** PostgreSQL's RLS UPDATE evaluation
 * requires the new row to remain visible via at least one SELECT policy
 * (this is implicit on top of any explicit WITH CHECK). Tables that have
 * a "live" SELECT policy (`USING deleted_at IS NULL`) plus a separate
 * "trash" SELECT policy (`USING deleted_at IS NOT NULL AND
 * app.include_deleted = 'true'`) make the post-update row INVISIBLE to
 * any caller that hasn't set `app.include_deleted='true'`. The fix:
 * temporarily set the trash flag for the duration of the soft-delete UPDATE
 * so the post-update row matches the trash policy and the WITH CHECK passes.
 *
 * The flag is reset to its prior value before returning so the caller's
 * surrounding wrapper context is preserved.
 *
 * @param tx - Scoped transaction from the caller's withAdmin/withReseller/withTenant wrapper.
 *             The table's RLS UPDATE policy must allow setting deleted_at for the active DB role.
 */
export async function softDelete(tx: DrizzleDB, table: PgTable, id: string): Promise<void> {
  assertSoftDeletable(table);
  const t = table as TableRef;
  const { userId } = getRequestContext();

  const [existing] = await tx.select({ id: t.id }).from(table).where(eq(t.id, id));

  if (!existing) {
    throw new NotFoundException('Record not found');
  }

  await withTrashFlag(tx, async () => {
    await tx
      .update(table as TableRef)
      .set({ deletedAt: new Date(), deletedBy: userId })
      .where(eq(t.id, id));
  });
}

/**
 * Restore a soft-deleted record by clearing deletedAt/deletedBy.
 *
 * @param tx - Scoped transaction. Must be able to see soft-deleted rows
 *             (e.g. from withAdmin, or withTrash for tenant-scoped restore).
 */
export async function restoreDeleted(tx: DrizzleDB, table: PgTable, id: string): Promise<void> {
  assertSoftDeletable(table);
  const t = table as TableRef;

  const [existing] = await tx.select({ id: t.id }).from(table).where(eq(t.id, id));

  if (!existing) {
    throw new NotFoundException('Record not found or not deleted');
  }

  // The pre-update row is soft-deleted (visible only via trash), and the
  // post-update row is live. Both need to be visible during the UPDATE — the
  // caller's withTrash() handles the pre-row, and the live SELECT policy
  // handles the post-row. No additional flag needed here.
  await tx
    .update(table as TableRef)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(t.id, id));
}

/**
 * Run `fn` with `app.include_deleted='true'` set on the active session, then
 * restore the previous value (or unset if it was unset). The flag must be
 * SET LOCAL so it auto-resets at transaction end as a defense-in-depth, but
 * we also restore eagerly so subsequent statements in the same transaction
 * don't see the trash view.
 */
async function withTrashFlag(tx: DrizzleDB, fn: () => Promise<void>): Promise<void> {
  const before = await tx.execute<{ value: string | null }>(
    sql`SELECT current_setting('app.include_deleted', true) AS value`,
  );
  const previous = before.rows[0]?.value ?? '';

  try {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    await fn();
  } finally {
    await tx.execute(sql`SELECT set_config('app.include_deleted', ${previous}, true)`);
  }
}
