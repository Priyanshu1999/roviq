import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
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
 * Checks FK references via savepoint before deleting — throws ConflictException if referenced.
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

  // FK reference check via savepoint — if referenced, suggest status change instead
  try {
    await tx.execute(sql`SAVEPOINT fk_check`);
    await tx.execute(sql`DELETE FROM ${table} WHERE id = ${id}`);
    await tx.execute(sql`ROLLBACK TO SAVEPOINT fk_check`);
  } catch (err) {
    await tx.execute(sql`ROLLBACK TO SAVEPOINT fk_check`);
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23503') {
      throw new ConflictException(
        'Cannot delete — other records reference this entity. Change its status instead.',
      );
    }
    throw err;
  }

  await tx
    .update(table as TableRef)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(t.id, id));
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

  await tx
    .update(table as TableRef)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(t.id, id));
}
