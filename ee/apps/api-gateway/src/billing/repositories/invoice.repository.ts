import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, institutes, withReseller } from '@roviq/database';
import { invoices, resellerInvoiceSequences, subscriptions } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm';

@Injectable()
export class InvoiceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  /**
   * Atomic invoice number generation: {RESELLER_CODE}-{YYYY}-{SEQUENCE}.
   * Year rollover resets sequence to 0.
   */
  async nextInvoiceNumber(resellerId: string, resellerCode: string): Promise<string> {
    return withReseller(this.db, resellerId, async (tx) => {
      const year = new Date().getFullYear();

      // Upsert: insert or reset on year change, then increment
      const [row] = await tx
        .insert(resellerInvoiceSequences)
        .values({ resellerId, currentYear: year, lastSequence: 1 })
        .onConflictDoUpdate({
          target: resellerInvoiceSequences.resellerId,
          set: {
            lastSequence: sql`CASE
              WHEN ${resellerInvoiceSequences.currentYear} = ${year}
              THEN ${resellerInvoiceSequences.lastSequence} + 1
              ELSE 1
            END`,
            currentYear: year,
          },
        })
        .returning();

      const seq = String(row.lastSequence).padStart(5, '0');
      return `${resellerCode}-${year}-${seq}`;
    });
  }

  async create(resellerId: string, data: typeof invoices.$inferInsert) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [invoice] = await tx.insert(invoices).values(data).returning();
      return invoice;
    });
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      return invoice ?? null;
    });
  }

  async updateStatus(resellerId: string, id: string, data: Partial<typeof invoices.$inferInsert>) {
    return withReseller(this.db, resellerId, async (tx) => {
      const [invoice] = await tx
        .update(invoices)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(invoices.id, id))
        .returning();
      return invoice;
    });
  }

  async findByResellerId(
    resellerId: string,
    params: {
      tenantId?: string;
      status?: string;
      from?: Date;
      to?: Date;
      first: number;
      after?: string;
    },
  ) {
    return withReseller(this.db, resellerId, async (tx) => {
      const conditions: SQL[] = [];
      if (params.tenantId) conditions.push(eq(invoices.tenantId, params.tenantId));
      if (params.status) {
        conditions.push(
          eq(invoices.status, params.status as (typeof invoices.$inferSelect)['status']),
        );
      }
      if (params.from) conditions.push(gte(invoices.createdAt, params.from));
      if (params.to) conditions.push(lte(invoices.createdAt, params.to));

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: invoices.createdAt, id: invoices.id })
          .from(invoices)
          .where(eq(invoices.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${invoices.createdAt}, ${invoices.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        tx
          .select({
            invoice: invoices,
            subscription: { id: subscriptions.id, tenantId: subscriptions.tenantId },
            institute: { id: institutes.id, name: institutes.name },
          })
          .from(invoices)
          .innerJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
          .innerJoin(institutes, eq(invoices.tenantId, institutes.id))
          .where(where)
          .orderBy(desc(invoices.createdAt), desc(invoices.id))
          .limit(params.first),
        tx.select({ total: count() }).from(invoices).where(where),
      ]);

      return {
        items: items.map((row) => ({
          ...row.invoice,
          subscription: { id: row.subscription.id, institute: row.institute },
        })),
        totalCount: total,
      };
    });
  }
}
