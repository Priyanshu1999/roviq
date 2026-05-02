import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AcademicYearStatus,
  academicYears,
  academicYearsLive,
  DRIZZLE_DB,
  type DrizzleDB,
  mkInstituteCtx,
  softDelete,
  type TermConfig,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { AcademicYearRepository } from './academic-year.repository';
import type { AcademicYearRecord, CreateAcademicYearData, UpdateAcademicYearData } from './types';

// Read projection — `academic_years_live` view excludes soft-deleted rows.
const liveColumns = {
  id: academicYearsLive.id,
  tenantId: academicYearsLive.tenantId,
  label: academicYearsLive.label,
  startDate: academicYearsLive.startDate,
  endDate: academicYearsLive.endDate,
  isActive: academicYearsLive.isActive,
  status: academicYearsLive.status,
  termStructure: academicYearsLive.termStructure,
  boardExamDates: academicYearsLive.boardExamDates,
  createdAt: academicYearsLive.createdAt,
  updatedAt: academicYearsLive.updatedAt,
} as const;

// Same projection on the base table — used by INSERT/UPDATE … RETURNING.
const writeReturning = {
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
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      const rows = await tx
        .select(liveColumns)
        .from(academicYearsLive)
        .where(eq(academicYearsLive.id, id));
      return (rows[0] as AcademicYearRecord | undefined) ?? null;
    });
  }

  async findAll(): Promise<AcademicYearRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      return tx
        .select(liveColumns)
        .from(academicYearsLive)
        .orderBy(asc(academicYearsLive.startDate)) as Promise<AcademicYearRecord[]>;
    });
  }

  async findActive(): Promise<AcademicYearRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      const rows = await tx
        .select(liveColumns)
        .from(academicYearsLive)
        .where(eq(academicYearsLive.isActive, true));
      return (rows[0] as AcademicYearRecord | undefined) ?? null;
    });
  }

  async findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<AcademicYearRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      const conditions = [
        // Date ranges overlap: existing.start < new.end AND existing.end > new.start
        sql`${academicYearsLive.startDate} < ${endDate}`,
        sql`${academicYearsLive.endDate} > ${startDate}`,
      ];
      if (excludeId) {
        conditions.push(ne(academicYearsLive.id, excludeId));
      }
      return tx
        .select(liveColumns)
        .from(academicYearsLive)
        .where(and(...conditions)) as Promise<AcademicYearRecord[]>;
    });
  }

  async create(data: CreateAcademicYearData): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
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
        .returning(writeReturning);
      return rows[0] as AcademicYearRecord;
    });
  }

  async update(id: string, data: UpdateAcademicYearData): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
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
        .returning(writeReturning);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }

  async activate(id: string, previousActiveId: string | null): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
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
        .returning(writeReturning);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }

  async updateStatus(id: string, status: AcademicYearStatus): Promise<AcademicYearRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      const rows = await tx
        .update(academicYears)
        .set({ status, updatedBy: userId })
        .where(eq(academicYears.id, id))
        .returning(writeReturning);

      if (rows.length === 0) throw new NotFoundException(`Academic year ${id} not found`);
      return rows[0] as AcademicYearRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, mkInstituteCtx(tenantId, 'repository:academic-year'), async (tx) => {
      await softDelete(tx, academicYears, id);
    });
  }
}
