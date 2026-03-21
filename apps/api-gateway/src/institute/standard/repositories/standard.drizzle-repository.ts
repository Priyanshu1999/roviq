import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, standards, withTenant } from '@roviq/database';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { StandardRepository } from './standard.repository';
import type { CreateStandardData, StandardRecord, UpdateStandardData } from './types';

const columns = {
  id: standards.id,
  tenantId: standards.tenantId,
  academicYearId: standards.academicYearId,
  name: standards.name,
  numericOrder: standards.numericOrder,
  level: standards.level,
  nepStage: standards.nepStage,
  department: standards.department,
  isBoardExamClass: standards.isBoardExamClass,
  streamApplicable: standards.streamApplicable,
  maxSectionsAllowed: standards.maxSectionsAllowed,
  maxStudentsPerSection: standards.maxStudentsPerSection,
  udiseClassCode: standards.udiseClassCode,
  createdAt: standards.createdAt,
  updatedAt: standards.updatedAt,
} as const;

@Injectable()
export class StandardDrizzleRepository extends StandardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<StandardRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.select(columns).from(standards).where(eq(standards.id, id));
      return (rows[0] as StandardRecord | undefined) ?? null;
    });
  }

  async findByAcademicYear(academicYearId: string): Promise<StandardRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(columns)
        .from(standards)
        .where(eq(standards.academicYearId, academicYearId))
        .orderBy(asc(standards.numericOrder)) as Promise<StandardRecord[]>;
    });
  }

  async create(data: CreateStandardData): Promise<StandardRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(standards)
        .values({
          tenantId,
          academicYearId: data.academicYearId,
          name: data.name,
          numericOrder: data.numericOrder,
          level: data.level as (typeof standards.level.enumValues)[number] | undefined,
          nepStage: data.nepStage as (typeof standards.nepStage.enumValues)[number] | undefined,
          department: data.department,
          isBoardExamClass: data.isBoardExamClass,
          streamApplicable: data.streamApplicable,
          maxSectionsAllowed: data.maxSectionsAllowed,
          maxStudentsPerSection: data.maxStudentsPerSection,
          udiseClassCode: data.udiseClassCode,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);
      return rows[0] as StandardRecord;
    });
  }

  async update(id: string, data: UpdateStandardData): Promise<StandardRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(standards)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.numericOrder !== undefined && { numericOrder: data.numericOrder }),
          ...(data.level !== undefined && {
            level: data.level as (typeof standards.level.enumValues)[number] | undefined,
          }),
          ...(data.nepStage !== undefined && {
            nepStage: data.nepStage as (typeof standards.nepStage.enumValues)[number] | undefined,
          }),
          ...(data.department !== undefined && { department: data.department }),
          ...(data.isBoardExamClass !== undefined && { isBoardExamClass: data.isBoardExamClass }),
          ...(data.streamApplicable !== undefined && { streamApplicable: data.streamApplicable }),
          ...(data.maxSectionsAllowed !== undefined && {
            maxSectionsAllowed: data.maxSectionsAllowed,
          }),
          ...(data.maxStudentsPerSection !== undefined && {
            maxStudentsPerSection: data.maxStudentsPerSection,
          }),
          ...(data.udiseClassCode !== undefined && { udiseClassCode: data.udiseClassCode }),
          updatedBy: userId,
        })
        .where(and(eq(standards.id, id), isNull(standards.deletedAt)))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Standard ${id} not found`);
      return rows[0] as StandardRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(standards)
        .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId })
        .where(and(eq(standards.id, id), isNull(standards.deletedAt)))
        .returning({ id: standards.id });
      if (rows.length === 0) throw new NotFoundException(`Standard ${id} not found`);
    });
  }
}
