import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, holidays, softDelete, withTenant } from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { HolidayRepository } from './holiday.repository';
import type {
  CreateHolidayData,
  HolidayListQuery,
  HolidayOnDateQuery,
  HolidayRecord,
  UpdateHolidayData,
} from './types';

const columns = {
  id: holidays.id,
  tenantId: holidays.tenantId,
  name: holidays.name,
  description: holidays.description,
  type: holidays.type,
  startDate: holidays.startDate,
  endDate: holidays.endDate,
  tags: holidays.tags,
  isPublic: holidays.isPublic,
  createdAt: holidays.createdAt,
  updatedAt: holidays.updatedAt,
} as const;

@Injectable()
export class HolidayDrizzleRepository extends HolidayRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<HolidayRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select(columns)
        .from(holidays)
        .where(and(eq(holidays.id, id), isNull(holidays.deletedAt)));
      return (rows[0] as HolidayRecord | undefined) ?? null;
    });
  }

  async list(query: HolidayListQuery): Promise<HolidayRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [isNull(holidays.deletedAt)];
      if (query.type) conditions.push(eq(holidays.type, query.type));
      if (query.isPublic !== undefined) conditions.push(eq(holidays.isPublic, query.isPublic));
      // Date-range filter uses overlap semantics:
      //   holiday.startDate <= range.endDate AND holiday.endDate >= range.startDate
      if (query.endDate) conditions.push(lte(holidays.startDate, query.endDate));
      if (query.startDate) conditions.push(gte(holidays.endDate, query.startDate));
      return tx
        .select(columns)
        .from(holidays)
        .where(and(...conditions))
        .orderBy(sql`${holidays.startDate} ASC`) as Promise<HolidayRecord[]>;
    });
  }

  async create(data: CreateHolidayData): Promise<HolidayRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(holidays)
        .values({
          tenantId,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          startDate: data.startDate,
          endDate: data.endDate,
          tags: data.tags ?? [],
          ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);
      return rows[0] as HolidayRecord;
    });
  }

  async update(id: string, data: UpdateHolidayData): Promise<HolidayRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(holidays)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
          updatedBy: userId,
        })
        .where(and(eq(holidays.id, id), isNull(holidays.deletedAt)))
        .returning(columns);
      if (rows.length === 0) throw new NotFoundException(`Holiday ${id} not found`);
      return rows[0] as HolidayRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await softDelete(tx, holidays, id);
    });
  }

  async onDate(query: HolidayOnDateQuery): Promise<HolidayRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(columns)
        .from(holidays)
        .where(
          and(
            lte(holidays.startDate, query.date),
            gte(holidays.endDate, query.date),
            isNull(holidays.deletedAt),
          ),
        ) as Promise<HolidayRecord[]>;
    });
  }
}
