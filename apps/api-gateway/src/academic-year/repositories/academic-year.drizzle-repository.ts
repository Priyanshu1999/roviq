import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import {
  type AcademicYearStatus,
  academicYears,
  DRIZZLE_DB,
  type DrizzleDB,
  type TermConfig,
  withTenant,
} from '@roviq/database';
import { and, asc, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';
import { AcademicYearRepository } from './academic-year.repository';
import type { AcademicYearRecord, CreateAcademicYearData, UpdateAcademicYearData } from './types';

const columns = {
  id: academicYears.id,
  tenantId: academicYears.tenantId,
  label: academicYears.label,
  startDate: academicYears.startDate,
  endDate: academicYears.endDate,
  isActive: academicYears.isActive,
  status: academicYears.status,
  termStructure: academicYears.termStructure,
  boardExamDates: academicYears.boardExamDates,
  createdAt: academicYears.createdAt,
  updatedAt: academicYears.updatedAt,
} as const;

@Injectable()
export class AcademicYearDrizzleRepository extends AcademicYearRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<AcademicYearRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.select(columns).from(academicYears).where(eq(academicYears.id, id));
      return (rows[0] as AcademicYearRecord | undefined) ?? null;
    });
  }

  async findAll(): Promise<AcademicYearRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(columns)
        .from(academicYears)
        .orderBy(asc(academicYears.startDate)) as Promise<AcademicYearRecord[]>;
    });
  }

  async findActive(): Promise<AcademicYearRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select(columns)
        .from(academicYears)
        .where(eq(academicYears.isActive, true));
      return (rows[0] as AcademicYearRecord | undefined) ?? null;
    });
  }

  async findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<AcademicYearRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [
        // Date ranges overlap: existing.start < new.end AND existing.end > new.start
        sql`${academicYears.startDate} < ${endDate}`,
        sql`${academicYears.endDate} > ${startDate}`,
      ];
      if (excludeId) {
        conditions.push(ne(academicYears.id, excludeId));
      }
      return tx
        .select(columns)
        .from(academicYears)
        .where(and(...conditions)) as Promise<AcademicYearRecord[]>;
    });
  }

  async create(data: CreateAcademicYearData): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(academicYears)
        .values({
          tenantId,
          label: data.label,
          startDate: data.startDate,
          endDate: data.endDate,
          termStructure: (data.termStructure ?? []) as TermConfig[],
          status: 'PLANNING',
          isActive: false,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);
      return rows[0] as AcademicYearRecord;
    });
  }

  async update(id: string, data: UpdateAcademicYearData): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(academicYears)
        .set({
          ...(data.label !== undefined && { label: data.label }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.termStructure !== undefined && {
            termStructure: data.termStructure as TermConfig[],
          }),
          ...(data.boardExamDates !== undefined && { boardExamDates: data.boardExamDates }),
          updatedBy: userId,
        })
        .where(and(eq(academicYears.id, id), isNull(academicYears.deletedAt)))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }

  async activate(id: string, previousActiveId: string | null): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      // Deactivate previous active year
      if (previousActiveId) {
        await tx
          .update(academicYears)
          .set({ isActive: false, status: 'COMPLETING', updatedBy: userId })
          .where(eq(academicYears.id, previousActiveId));
      }

      // Activate target year
      const rows = await tx
        .update(academicYears)
        .set({ isActive: true, status: 'ACTIVE', updatedBy: userId })
        .where(eq(academicYears.id, id))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }

  async updateStatus(id: string, status: string): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(academicYears)
        .set({ status: status as AcademicYearStatus, updatedBy: userId })
        .where(eq(academicYears.id, id))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }
}
