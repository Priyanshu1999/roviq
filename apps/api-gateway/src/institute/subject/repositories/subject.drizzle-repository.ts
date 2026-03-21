import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  sectionSubjects,
  standardSubjects,
  subjects,
  withTenant,
} from '@roviq/database';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { SubjectRepository } from './subject.repository';
import type { CreateSubjectData, SubjectRecord, UpdateSubjectData } from './types';

const columns = {
  id: subjects.id,
  tenantId: subjects.tenantId,
  name: subjects.name,
  shortName: subjects.shortName,
  boardCode: subjects.boardCode,
  type: subjects.type,
  isMandatory: subjects.isMandatory,
  hasPractical: subjects.hasPractical,
  theoryMarks: subjects.theoryMarks,
  practicalMarks: subjects.practicalMarks,
  internalMarks: subjects.internalMarks,
  isElective: subjects.isElective,
  electiveGroup: subjects.electiveGroup,
  createdAt: subjects.createdAt,
  updatedAt: subjects.updatedAt,
} as const;

type SubjectTypeEnum = (typeof subjects.type.enumValues)[number];

@Injectable()
export class SubjectDrizzleRepository extends SubjectRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<SubjectRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.select(columns).from(subjects).where(eq(subjects.id, id));
      return (rows[0] as SubjectRecord | undefined) ?? null;
    });
  }

  async findAll(): Promise<SubjectRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      return tx.select(columns).from(subjects).orderBy(asc(subjects.name)) as Promise<
        SubjectRecord[]
      >;
    });
  }

  async findByStandard(standardId: string): Promise<SubjectRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const links = await tx
        .select({ subjectId: standardSubjects.subjectId })
        .from(standardSubjects)
        .where(eq(standardSubjects.standardId, standardId));

      if (links.length === 0) return [];

      const subjectIds = links.map((l) => l.subjectId);
      return tx
        .select(columns)
        .from(subjects)
        .where(inArray(subjects.id, subjectIds))
        .orderBy(asc(subjects.name)) as Promise<SubjectRecord[]>;
    });
  }

  async create(data: CreateSubjectData): Promise<SubjectRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(subjects)
        .values({
          tenantId,
          name: data.name,
          shortName: data.shortName,
          boardCode: data.boardCode,
          type: (data.type as SubjectTypeEnum) ?? 'ACADEMIC',
          isMandatory: data.isMandatory,
          hasPractical: data.hasPractical,
          theoryMarks: data.theoryMarks,
          practicalMarks: data.practicalMarks,
          internalMarks: data.internalMarks,
          isElective: data.isElective,
          electiveGroup: data.electiveGroup,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(columns);

      const subject = rows[0] as SubjectRecord;

      // Link to standards if provided
      if (data.standardIds?.length) {
        await tx.insert(standardSubjects).values(
          data.standardIds.map((standardId) => ({
            tenantId,
            subjectId: subject.id,
            standardId,
            createdBy: userId,
            updatedBy: userId,
          })),
        );
      }

      // Link to sections if provided
      if (data.sectionIds?.length) {
        await tx.insert(sectionSubjects).values(
          data.sectionIds.map((sectionId) => ({
            tenantId,
            subjectId: subject.id,
            sectionId,
            createdBy: userId,
            updatedBy: userId,
          })),
        );
      }

      return subject;
    });
  }

  async update(id: string, data: UpdateSubjectData): Promise<SubjectRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(subjects)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.shortName !== undefined && { shortName: data.shortName }),
          ...(data.boardCode !== undefined && { boardCode: data.boardCode }),
          ...(data.type !== undefined && { type: data.type as SubjectTypeEnum }),
          ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
          ...(data.hasPractical !== undefined && { hasPractical: data.hasPractical }),
          ...(data.theoryMarks !== undefined && { theoryMarks: data.theoryMarks }),
          ...(data.practicalMarks !== undefined && { practicalMarks: data.practicalMarks }),
          ...(data.internalMarks !== undefined && { internalMarks: data.internalMarks }),
          ...(data.isElective !== undefined && { isElective: data.isElective }),
          ...(data.electiveGroup !== undefined && { electiveGroup: data.electiveGroup }),
          updatedBy: userId,
        })
        .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Subject ${id} not found`);
      return rows[0] as SubjectRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(subjects)
        .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId })
        .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
        .returning({ id: subjects.id });
      if (rows.length === 0) throw new NotFoundException(`Subject ${id} not found`);
    });
  }

  async assignToStandard(subjectId: string, standardId: string): Promise<void> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .insert(standardSubjects)
        .values({ tenantId, subjectId, standardId, createdBy: userId, updatedBy: userId })
        .onConflictDoNothing();
    });
  }

  async removeFromStandard(subjectId: string, standardId: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .delete(standardSubjects)
        .where(
          and(
            eq(standardSubjects.subjectId, subjectId),
            eq(standardSubjects.standardId, standardId),
          ),
        );
    });
  }

  async assignToSection(subjectId: string, sectionId: string): Promise<void> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .insert(sectionSubjects)
        .values({ tenantId, subjectId, sectionId, createdBy: userId, updatedBy: userId })
        .onConflictDoNothing();
    });
  }

  async removeFromSection(subjectId: string, sectionId: string): Promise<void> {
    const tenantId = this.getTenantId();
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .delete(sectionSubjects)
        .where(
          and(eq(sectionSubjects.subjectId, subjectId), eq(sectionSubjects.sectionId, sectionId)),
        );
    });
  }
}
