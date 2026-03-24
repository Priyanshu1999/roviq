import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, sections, softDelete, withTenant } from '@roviq/database';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { SectionRepository } from './section.repository';
import type { CreateSectionData, SectionRecord, UpdateSectionData } from './types';

const columns = {
  id: sections.id,
  tenantId: sections.tenantId,
  standardId: sections.standardId,
  academicYearId: sections.academicYearId,
  name: sections.name,
  displayLabel: sections.displayLabel,
  stream: sections.stream,
  mediumOfInstruction: sections.mediumOfInstruction,
  shift: sections.shift,
  classTeacherId: sections.classTeacherId,
  room: sections.room,
  capacity: sections.capacity,
  currentStrength: sections.currentStrength,
  genderRestriction: sections.genderRestriction,
  displayOrder: sections.displayOrder,
  startTime: sections.startTime,
  endTime: sections.endTime,
  batchStatus: sections.batchStatus,
  createdAt: sections.createdAt,
  updatedAt: sections.updatedAt,
} as const;

type GenderEnum = (typeof sections.genderRestriction.enumValues)[number];
type BatchEnum = (typeof sections.batchStatus.enumValues)[number];

@Injectable()
export class SectionDrizzleRepository extends SectionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<SectionRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.select(columns).from(sections).where(eq(sections.id, id));
      return (rows[0] as SectionRecord | undefined) ?? null;
    });
  }

  async findByStandard(standardId: string): Promise<SectionRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(columns)
        .from(sections)
        .where(eq(sections.standardId, standardId))
        .orderBy(asc(sections.displayOrder)) as Promise<SectionRecord[]>;
    });
  }

  async create(data: CreateSectionData): Promise<SectionRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(sections)
        .values({
          tenantId,
          standardId: data.standardId,
          academicYearId: data.academicYearId,
          name: data.name,
          displayLabel: data.displayLabel,
          stream: data.stream,
          mediumOfInstruction: data.mediumOfInstruction,
          shift: data.shift,
          room: data.room,
          capacity: data.capacity,
          genderRestriction: (data.genderRestriction as GenderEnum) ?? 'CO_ED',
          displayOrder: data.displayOrder ?? 0,
          startTime: data.startTime,
          endTime: data.endTime,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);
      return rows[0] as SectionRecord;
    });
  }

  async update(id: string, data: UpdateSectionData): Promise<SectionRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(sections)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.displayLabel !== undefined && { displayLabel: data.displayLabel }),
          ...(data.stream !== undefined && { stream: data.stream }),
          ...(data.mediumOfInstruction !== undefined && {
            mediumOfInstruction: data.mediumOfInstruction,
          }),
          ...(data.shift !== undefined && { shift: data.shift }),
          ...(data.classTeacherId !== undefined && { classTeacherId: data.classTeacherId }),
          ...(data.room !== undefined && { room: data.room }),
          ...(data.capacity !== undefined && { capacity: data.capacity }),
          ...(data.genderRestriction !== undefined && {
            genderRestriction: data.genderRestriction as GenderEnum,
          }),
          ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
          ...(data.startTime !== undefined && { startTime: data.startTime }),
          ...(data.endTime !== undefined && { endTime: data.endTime }),
          ...(data.batchStatus !== undefined && { batchStatus: data.batchStatus as BatchEnum }),
          updatedBy: userId,
        })
        .where(and(eq(sections.id, id), isNull(sections.deletedAt)))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Section ${id} not found`);
      return rows[0] as SectionRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await softDelete(tx, sections, id);
    });
  }
}
