import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, leaves, softDelete, withTenant } from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { LeaveRepository } from './leave.repository';
import type {
  CreateLeaveData,
  LeaveListQuery,
  LeaveOnDateQuery,
  LeaveRecord,
  UpdateLeaveData,
} from './types';

const columns = {
  id: leaves.id,
  tenantId: leaves.tenantId,
  userId: leaves.userId,
  startDate: leaves.startDate,
  endDate: leaves.endDate,
  type: leaves.type,
  reason: leaves.reason,
  status: leaves.status,
  fileUrls: leaves.fileUrls,
  decidedBy: leaves.decidedBy,
  createdAt: leaves.createdAt,
  updatedAt: leaves.updatedAt,
} as const;

@Injectable()
export class LeaveDrizzleRepository extends LeaveRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<LeaveRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select(columns)
        .from(leaves)
        .where(and(eq(leaves.id, id), isNull(leaves.deletedAt)));
      return (rows[0] as LeaveRecord | undefined) ?? null;
    });
  }

  async list(query: LeaveListQuery): Promise<LeaveRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [isNull(leaves.deletedAt)];
      if (query.userId) conditions.push(eq(leaves.userId, query.userId));
      if (query.status) conditions.push(eq(leaves.status, query.status));
      if (query.type) conditions.push(eq(leaves.type, query.type));
      // Date-range filter uses overlap semantics:
      //   leave.startDate <= range.endDate AND leave.endDate >= range.startDate
      if (query.endDate) conditions.push(lte(leaves.startDate, query.endDate));
      if (query.startDate) conditions.push(gte(leaves.endDate, query.startDate));
      return tx
        .select(columns)
        .from(leaves)
        .where(and(...conditions))
        .orderBy(sql`${leaves.startDate} DESC`) as Promise<LeaveRecord[]>;
    });
  }

  async create(data: CreateLeaveData): Promise<LeaveRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(leaves)
        .values({
          tenantId,
          userId: data.userId,
          startDate: data.startDate,
          endDate: data.endDate,
          type: data.type,
          reason: data.reason,
          fileUrls: data.fileUrls ?? [],
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);
      return rows[0] as LeaveRecord;
    });
  }

  async update(id: string, data: UpdateLeaveData): Promise<LeaveRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(leaves)
        .set({
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.reason !== undefined && { reason: data.reason }),
          ...(data.fileUrls !== undefined && { fileUrls: data.fileUrls }),
          updatedBy: userId,
        })
        .where(and(eq(leaves.id, id), isNull(leaves.deletedAt)))
        .returning(columns);
      if (rows.length === 0) throw new NotFoundException(`Leave ${id} not found`);
      return rows[0] as LeaveRecord;
    });
  }

  async setStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    decidedBy: string,
  ): Promise<LeaveRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(leaves)
        .set({ status, decidedBy, updatedBy: userId })
        .where(and(eq(leaves.id, id), isNull(leaves.deletedAt)))
        .returning(columns);
      if (rows.length === 0) throw new NotFoundException(`Leave ${id} not found`);
      return rows[0] as LeaveRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await softDelete(tx, leaves, id);
    });
  }

  async approvedOnDate(query: LeaveOnDateQuery): Promise<string[]> {
    if (query.userIds.length === 0) return [];
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({ userId: leaves.userId })
        .from(leaves)
        .where(
          and(
            inArray(leaves.userId, query.userIds),
            eq(leaves.status, 'APPROVED'),
            lte(leaves.startDate, query.date),
            gte(leaves.endDate, query.date),
            isNull(leaves.deletedAt),
          ),
        );
      return rows.map((r) => r.userId);
    });
  }
}
