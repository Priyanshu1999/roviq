import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, institutes, withAdmin } from '@roviq/database';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { InstituteRepository } from './institute.repository';
import type { CreateInstituteData, InstituteRecord, UpdateInstituteInfoData } from './types';

const instituteColumns = {
  id: institutes.id,
  name: institutes.name,
  slug: institutes.slug,
  code: institutes.code,
  type: institutes.type,
  structureFramework: institutes.structureFramework,
  setupStatus: institutes.setupStatus,
  contact: institutes.contact,
  address: institutes.address,
  logoUrl: institutes.logoUrl,
  timezone: institutes.timezone,
  currency: institutes.currency,
  settings: institutes.settings,
  status: institutes.status,
  createdAt: institutes.createdAt,
  updatedAt: institutes.updatedAt,
} as const;

@Injectable()
export class InstituteDrizzleRepository extends InstituteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findById(id: string): Promise<InstituteRecord | null> {
    // institutes table uses entityPolicies (no tenantId) — use withAdmin for direct lookup
    return withAdmin(this.db, async (tx) => {
      const rows = await tx.select(instituteColumns).from(institutes).where(eq(institutes.id, id));
      return (rows[0] as InstituteRecord | undefined) ?? null;
    });
  }

  async create(data: CreateInstituteData): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .insert(institutes)
        .values({
          name: data.name,
          slug: data.slug,
          code: data.code,
          type: data.type as 'SCHOOL' | 'COACHING' | 'LIBRARY' | undefined,
          structureFramework: data.structureFramework as 'NEP' | 'TRADITIONAL' | undefined,
          contact: data.contact ?? { phones: [], emails: [] },
          address: data.address,
          status: 'PENDING',
          setupStatus: 'PENDING',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(instituteColumns);

      return rows[0] as InstituteRecord;
    });
  }

  async updateInfo(id: string, data: UpdateInstituteInfoData): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
          ...(data.contact !== undefined && { contact: data.contact }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.timezone !== undefined && { timezone: data.timezone }),
          ...(data.currency !== undefined && { currency: data.currency }),
          updatedBy: userId,
        })
        .where(eq(institutes.id, id))
        .returning(instituteColumns);

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${id} not found`);
      }
      return rows[0] as InstituteRecord;
    });
  }

  async updateStatus(id: string, status: string): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({
          status: status as 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED',
          updatedBy: userId,
        })
        .where(and(eq(institutes.id, id), isNull(institutes.deletedAt)))
        .returning(instituteColumns);

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${id} not found`);
      }
      return rows[0] as InstituteRecord;
    });
  }

  async findByIdIncludeDeleted(id: string): Promise<InstituteRecord | null> {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx.select(instituteColumns).from(institutes).where(eq(institutes.id, id));
      return (rows[0] as InstituteRecord | undefined) ?? null;
    });
  }

  async softDelete(id: string): Promise<void> {
    const { userId } = getRequestContext();

    await withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId })
        .where(and(eq(institutes.id, id), isNull(institutes.deletedAt)))
        .returning({ id: institutes.id });

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${id} not found`);
      }
    });
  }

  async restore(id: string): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({ deletedAt: null, deletedBy: null, updatedBy: userId })
        .where(and(eq(institutes.id, id), isNotNull(institutes.deletedAt)))
        .returning(instituteColumns);

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${id} not found or not deleted`);
      }
      return rows[0] as InstituteRecord;
    });
  }
}
