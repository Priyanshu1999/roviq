import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  leaves,
  leavesLive,
  mkInstituteCtx,
  softDelete,
  withTenant,
} from '@roviq/database';
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

// Read projection — `leaves_live` view excludes soft-deleted rows.
const liveColumns = {
  id: leavesLive.id,
  tenantId: leavesLive.tenantId,
  userId: leavesLive.userId,
  startDate: leavesLive.startDate,
  endDate: leavesLive.endDate,
  type: leavesLive.type,
  reason: leavesLive.reason,
  status: leavesLive.status,
  fileUrls: leavesLive.fileUrls,
  decidedBy: leavesLive.decidedBy,
  createdAt: leavesLive.createdAt,
  updatedAt: leavesLive.updatedAt,
} as const;

const writeReturning = {
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
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const rows = await tx.select(liveColumns).from(leavesLive).where(eq(leavesLive.id, id));
      return (rows[0] as LeaveRecord | undefined) ?? null;
    });
  }

  async list(query: LeaveListQuery): Promise<LeaveRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const conditions = [];
      if (query.userId) conditions.push(eq(leavesLive.userId, query.userId));
      if (query.status) conditions.push(eq(leavesLive.status, query.status));
      if (query.type) conditions.push(eq(leavesLive.type, query.type));
      // Date-range filter uses overlap semantics:
      //   leave.startDate <= range.endDate AND leave.endDate >= range.startDate
      if (query.endDate) conditions.push(lte(leavesLive.startDate, query.endDate));
      if (query.startDate) conditions.push(gte(leavesLive.endDate, query.startDate));
      return tx
        .select(liveColumns)
        .from(leavesLive)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${leavesLive.startDate} DESC`) as Promise<LeaveRecord[]>;
    });
  }

  async create(data: CreateLeaveData): Promise<LeaveRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
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
        .returning(writeReturning);
      return rows[0] as LeaveRecord;
    });
  }

  async update(id: string, data: UpdateLeaveData): Promise<LeaveRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
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
        .returning(writeReturning);
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
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const rows = await tx
        .update(leaves)
        .set({ status, decidedBy, updatedBy: userId })
        .where(and(eq(leaves.id, id), isNull(leaves.deletedAt)))
        .returning(writeReturning);
      if (rows.length === 0) throw new NotFoundException(`Leave ${id} not found`);
      return rows[0] as LeaveRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      await softDelete(tx, leaves, id);
    });
  }

  async approvedOnDate(query: LeaveOnDateQuery): Promise<string[]> {
    if (query.userIds.length === 0) return [];
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const rows = await tx
        .select({ userId: leavesLive.userId })
        .from(leavesLive)
        .where(
          and(
            inArray(leavesLive.userId, query.userIds),
            eq(leavesLive.status, 'APPROVED'),
            lte(leavesLive.startDate, query.date),
            gte(leavesLive.endDate, query.date),
          ),
        );
      return rows.map((r) => r.userId);
    });
  }
}
