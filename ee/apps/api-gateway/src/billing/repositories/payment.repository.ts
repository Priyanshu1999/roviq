import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, mkResellerCtx, withReseller } from '@roviq/database';
import { payments } from '@roviq/ee-database';
import { getRequestContext } from '@roviq/request-context';
import { and, count, desc, eq, type SQL, sql } from 'drizzle-orm';

@Injectable()
export class PaymentRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get userId(): string {
    return getRequestContext().userId;
  }

  async create(resellerId: string, data: typeof payments.$inferInsert) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [payment] = await tx.insert(payments).values(data).returning();
      return payment;
    });
  }

  /** Idempotent: returns existing payment if gatewayPaymentId already exists */
  async findOrCreateByGatewayId(
    resellerId: string,
    gatewayPaymentId: string,
    data: typeof payments.$inferInsert,
  ) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      // Check existing first (idempotent webhook handling)
      const [existing] = await tx
        .select()
        .from(payments)
        .where(eq(payments.gatewayPaymentId, gatewayPaymentId))
        .limit(1);
      if (existing) return { payment: existing, created: false };

      const [payment] = await tx.insert(payments).values(data).returning();
      return { payment, created: true };
    });
  }

  async findById(resellerId: string, id: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
      return payment ?? null;
    });
  }

  async update(resellerId: string, id: string, data: Partial<typeof payments.$inferInsert>) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [payment] = await tx
        .update(payments)
        .set({ ...data, updatedAt: new Date(), updatedBy: this.userId })
        .where(eq(payments.id, id))
        .returning();
      return payment;
    });
  }

  async findByGatewayOrderId(resellerId: string, gatewayOrderId: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      return tx
        .select()
        .from(payments)
        .where(eq(payments.gatewayOrderId, gatewayOrderId))
        .orderBy(desc(payments.createdAt));
    });
  }

  async findByInvoiceId(resellerId: string, invoiceId: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      return tx
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId))
        .orderBy(desc(payments.createdAt));
    });
  }

  async findByTenantId(
    resellerId: string,
    tenantId: string,
    params: { first: number; after?: string },
  ) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const conditions: SQL[] = [eq(payments.tenantId, tenantId)];

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: payments.createdAt, id: payments.id })
          .from(payments)
          .where(eq(payments.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${payments.createdAt}, ${payments.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = and(...conditions);

      const [items, [{ total }]] = await Promise.all([
        tx
          .select()
          .from(payments)
          .where(where)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(params.first),
        tx.select({ total: count() }).from(payments).where(where),
      ]);

      return { items, totalCount: total };
    });
  }

  /** Find payment by UTR number — for duplicate UTR check */
  async findByUtrNumber(resellerId: string, utrNumber: string) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.utrNumber, utrNumber))
        .limit(1);
      return payment ?? null;
    });
  }

  /** Find payments pending UPI verification for a reseller */
  async findUnverified(resellerId: string, params: { first: number; after?: string }) {
    return withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
      const conditions: SQL[] = [eq(payments.verificationStatus, 'PENDING_VERIFICATION')];

      if (params.after) {
        const [cursor] = await tx
          .select({ createdAt: payments.createdAt, id: payments.id })
          .from(payments)
          .where(eq(payments.id, params.after))
          .limit(1);
        if (cursor) {
          conditions.push(
            sql`(${payments.createdAt}, ${payments.id}) < (${cursor.createdAt}, ${cursor.id})`,
          );
        }
      }

      const where = and(...conditions);

      const [items, [{ total }]] = await Promise.all([
        tx
          .select()
          .from(payments)
          .where(where)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(params.first),
        tx.select({ total: count() }).from(payments).where(where),
      ]);

      return { items, totalCount: total };
    });
  }
}
