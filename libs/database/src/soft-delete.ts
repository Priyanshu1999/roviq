import { NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/request-context';
import { eq, isNull, type SQL, sql } from 'drizzle-orm';
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
 * Predicate for "row is not soft-deleted". Use in repository read queries:
 *
 *   tx.select().from(subjects).where(and(eq(subjects.id, id), notDeleted(subjects)))
 *
 * Soft-delete visibility is enforced at the application layer (RLS policies
 * stay agnostic). Reads that should include trashed rows simply omit this
 * predicate; reads that should hide them MUST include it.
 */
export function notDeleted(table: PgTable): SQL {
  const t = table as TableRef;
  if (!t.deletedAt) {
    throw new Error(`Table ${t._.name} has no deletedAt column`);
  }
  return isNull(t.deletedAt);
}

/**
 * Soft-delete a record by setting deletedAt/deletedBy.
 *
 * Soft delete is an UPDATE, not a DELETE — it never triggers FK violations.
 * Visibility of the post-update row is managed entirely in the app layer
 * (repositories filter `deleted_at IS NULL`), so this helper is a plain UPDATE.
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

  await tx
    .update(table as TableRef)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(t.id, id));
}

/**
 * Restore a soft-deleted record by clearing deletedAt/deletedBy.
 *
 * Caller must read the deleted row through a query that does NOT include
 * `notDeleted()` (since the row is soft-deleted) — typically by routing the
 * "list trash" / "restore" UI through dedicated repository methods that omit
 * the predicate. The DB role just needs UPDATE privileges on the table.
 */
export async function restoreDeleted(tx: DrizzleDB, table: PgTable, id: string): Promise<void> {
  assertSoftDeletable(table);
  const t = table as TableRef;

  const [existing] = await tx.select({ id: t.id }).from(table).where(eq(t.id, id));
  if (!existing) {
    throw new NotFoundException('Record not found');
  }

  await tx
    .update(table as TableRef)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(t.id, id));
}

// Re-export sql so callers don't need a separate drizzle-orm import for niche
// uses like raw soft-delete predicates inside dynamic SQL fragments.
export { sql };
