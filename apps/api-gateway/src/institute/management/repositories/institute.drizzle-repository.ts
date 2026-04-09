import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessException, ErrorCode } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  type InstituteStatus,
  instituteAffiliations,
  instituteBranding,
  instituteConfigs,
  instituteIdentifiers,
  institutes,
  softDelete,
  withAdmin,
  withReseller,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { decodeCursor } from '../../../common/pagination/relay-pagination.model';
import { InstituteRepository } from './institute.repository';
import type {
  CreateInstituteData,
  InstituteRecord,
  InstituteSearchParams,
  InstituteStatistics,
  UpdateInstituteBrandingData,
  UpdateInstituteConfigData,
  UpdateInstituteInfoData,
} from './types';

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
  resellerId: institutes.resellerId,
  groupId: institutes.groupId,
  createdAt: institutes.createdAt,
  updatedAt: institutes.updatedAt,
} as const;

@Injectable()
export class InstituteDrizzleRepository extends InstituteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async search(
    params: InstituteSearchParams,
  ): Promise<{ records: InstituteRecord[]; total: number }> {
    const { search, status, statuses, type, resellerId, groupId, first = 20, after } = params;

    return withAdmin(this.db, async (tx) => {
      const conditions: SQL[] = [isNull(institutes.deletedAt)];

      // Multiple statuses take precedence over single status
      if (statuses && statuses.length > 0) {
        conditions.push(
          inArray(
            institutes.status,
            statuses as ('ACTIVE' | 'PENDING' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED')[],
          ),
        );
      } else if (status) {
        conditions.push(
          eq(
            institutes.status,
            status as 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED',
          ),
        );
      }
      if (type) conditions.push(eq(institutes.type, type as 'SCHOOL' | 'COACHING' | 'LIBRARY'));
      if (resellerId) conditions.push(eq(institutes.resellerId, resellerId));
      if (groupId) conditions.push(eq(institutes.groupId, groupId));
      if (search) {
        const searchTerm = search.trim();
        // Use pg_trgm similarity for typeahead (benefits from GIN trgm index)
        // Falls back to ILIKE for short queries
        if (searchTerm.length >= 3) {
          const tsQuery = searchTerm
            .split(/\s+/)
            .map((w) => `${w}:*`)
            .join(' & ');
          const searchCondition = or(
            sql`to_tsvector('english', COALESCE(${institutes.name}->>'en', '')) @@ to_tsquery('english', ${tsQuery})`,
            sql`COALESCE(${institutes.name}->>'en', '') % ${searchTerm}`,
            sql`COALESCE(${institutes.code}, '') % ${searchTerm}`,
          );
          if (searchCondition) conditions.push(searchCondition);
        } else {
          const pattern = `%${searchTerm}%`;
          const searchCondition = or(
            sql`${institutes.name}->>'en' ILIKE ${pattern}`,
            ilike(institutes.code, pattern),
          );
          if (searchCondition) conditions.push(searchCondition);
        }
      }

      // Cursor pagination
      if (after) {
        const cursor = decodeCursor(after);
        if (cursor.id) {
          conditions.push(sql`${institutes.id} > ${cursor.id as string}`);
        }
      }

      const where = and(...conditions);

      const [totalResult, records] = await Promise.all([
        tx.select({ value: count() }).from(institutes).where(where),
        tx
          .select(instituteColumns)
          .from(institutes)
          .where(where)
          .orderBy(asc(institutes.createdAt))
          .limit(first),
      ]);

      return {
        records: records as InstituteRecord[],
        total: totalResult[0]?.value ?? 0,
      };
    });
  }

  async findById(id: string): Promise<InstituteRecord | null> {
    // @TODO verify this claim.
    // withAdmin bypasses RLS (admin_all policy = true), so we must explicitly
    // filter out soft-deleted records that RLS would normally exclude.
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select(instituteColumns)
        .from(institutes)
        .where(and(eq(institutes.id, id), isNull(institutes.deletedAt)));
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
          ...(data.departments && {
            departments: data.departments as (
              | 'PRE_PRIMARY'
              | 'PRIMARY'
              | 'UPPER_PRIMARY'
              | 'SECONDARY'
              | 'SENIOR_SECONDARY'
            )[],
          }),
          ...(data.resellerId && { resellerId: data.resellerId }),
          ...(data.groupId && { groupId: data.groupId }),
          ...(data.isDemo !== undefined && { isDemo: data.isDemo }),
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
          version: sql`${institutes.version} + 1`,
          updatedBy: userId,
        })
        .where(and(eq(institutes.id, id), eq(institutes.version, data.version)))
        .returning(instituteColumns);

      if (rows.length === 0) {
        throw new BusinessException(
          ErrorCode.CONCURRENT_MODIFICATION,
          'Record was modified by another user. Please refresh and try again.',
        );
      }
      return rows[0] as InstituteRecord;
    });
  }

  async updateStatus(id: string, status: InstituteStatus): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({
          status,
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

  async updateBranding(id: string, data: UpdateInstituteBrandingData): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    await withAdmin(this.db, async (tx) => {
      await tx
        .insert(instituteBranding)
        .values({
          tenantId: id,
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
          ...(data.faviconUrl !== undefined && { faviconUrl: data.faviconUrl }),
          ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
          ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
          ...(data.themeIdentifier !== undefined && { themeIdentifier: data.themeIdentifier }),
          ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: instituteBranding.tenantId,
          // `institute_branding.tenant_id` uses a PARTIAL unique index
          // (WHERE deleted_at IS NULL). Postgres only matches ON CONFLICT to
          // partial unique indexes when the predicate matches exactly, so we
          // must repeat it here.
          targetWhere: sql`${instituteBranding.deletedAt} IS NULL`,
          set: {
            ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
            ...(data.faviconUrl !== undefined && { faviconUrl: data.faviconUrl }),
            ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
            ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
            ...(data.themeIdentifier !== undefined && { themeIdentifier: data.themeIdentifier }),
            ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
            updatedBy: userId,
          },
        });
    });

    const record = await this.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record;
  }

  async updateConfig(id: string, data: UpdateInstituteConfigData): Promise<InstituteRecord> {
    const { userId } = getRequestContext();

    await withAdmin(this.db, async (tx) => {
      await tx
        .insert(instituteConfigs)
        .values({
          tenantId: id,
          ...(data.attendanceType !== undefined && {
            attendanceType: data.attendanceType as 'LECTURE_WISE' | 'DAILY',
          }),
          ...(data.openingTime !== undefined && { openingTime: data.openingTime }),
          ...(data.closingTime !== undefined && { closingTime: data.closingTime }),
          ...(data.shifts !== undefined && { shifts: data.shifts }),
          ...(data.notificationPreferences !== undefined && {
            notificationPreferences: data.notificationPreferences,
          }),
          ...(data.payrollConfig !== undefined && { payrollConfig: data.payrollConfig }),
          ...(data.gradingSystem !== undefined && { gradingSystem: data.gradingSystem }),
          ...(data.termStructure !== undefined && { termStructure: data.termStructure }),
          ...(data.sectionStrengthNorms !== undefined && {
            sectionStrengthNorms: data.sectionStrengthNorms,
          }),
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: instituteConfigs.tenantId,
          // `institute_configs.tenant_id` uses a PARTIAL unique index
          // (WHERE deleted_at IS NULL). Postgres only matches ON CONFLICT to
          // partial unique indexes when the predicate matches exactly.
          targetWhere: sql`${instituteConfigs.deletedAt} IS NULL`,
          set: {
            ...(data.attendanceType !== undefined && {
              attendanceType: data.attendanceType as 'LECTURE_WISE' | 'DAILY',
            }),
            ...(data.openingTime !== undefined && { openingTime: data.openingTime }),
            ...(data.closingTime !== undefined && { closingTime: data.closingTime }),
            ...(data.shifts !== undefined && { shifts: data.shifts }),
            ...(data.notificationPreferences !== undefined && {
              notificationPreferences: data.notificationPreferences,
            }),
            ...(data.payrollConfig !== undefined && { payrollConfig: data.payrollConfig }),
            ...(data.gradingSystem !== undefined && { gradingSystem: data.gradingSystem }),
            ...(data.termStructure !== undefined && { termStructure: data.termStructure }),
            ...(data.sectionStrengthNorms !== undefined && {
              sectionStrengthNorms: data.sectionStrengthNorms,
            }),
            updatedBy: userId,
          },
        });
    });

    const record = await this.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record;
  }

  async findByIdIncludeDeleted(id: string): Promise<InstituteRecord | null> {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx.select(instituteColumns).from(institutes).where(eq(institutes.id, id));
      return (rows[0] as InstituteRecord | undefined) ?? null;
    });
  }

  async softDelete(id: string): Promise<void> {
    await withAdmin(this.db, async (tx) => {
      await softDelete(tx, institutes, id);
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

  async findBranding(instituteId: string): Promise<Record<string, unknown> | null> {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(instituteBranding)
        .where(eq(instituteBranding.tenantId, instituteId));
      return (rows[0] as Record<string, unknown> | undefined) ?? null;
    });
  }

  async findConfig(instituteId: string): Promise<Record<string, unknown> | null> {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(instituteConfigs)
        .where(eq(instituteConfigs.tenantId, instituteId));
      return (rows[0] as Record<string, unknown> | undefined) ?? null;
    });
  }

  async findIdentifiers(instituteId: string): Promise<Record<string, unknown>[]> {
    return withAdmin(this.db, async (tx) => {
      return tx
        .select()
        .from(instituteIdentifiers)
        .where(eq(instituteIdentifiers.tenantId, instituteId)) as Promise<
        Record<string, unknown>[]
      >;
    });
  }

  async findAffiliations(instituteId: string): Promise<Record<string, unknown>[]> {
    return withAdmin(this.db, async (tx) => {
      return tx
        .select()
        .from(instituteAffiliations)
        .where(eq(instituteAffiliations.tenantId, instituteId)) as Promise<
        Record<string, unknown>[]
      >;
    });
  }

  // ── Reseller-scoped methods ──────────────────────────

  async searchByReseller(
    resellerId: string,
    params: InstituteSearchParams,
  ): Promise<{ records: InstituteRecord[]; total: number }> {
    return withReseller(this.db, resellerId, async (tx) => {
      const conditions: SQL[] = [isNull(institutes.deletedAt)];

      if (params.search) {
        const pattern = `%${params.search}%`;
        const searchCondition = or(
          sql`${institutes.name}->>'en' ILIKE ${pattern}`,
          ilike(institutes.code, pattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }
      if (params.status) {
        conditions.push(sql`${institutes.status} = ${params.status}`);
      }
      if (params.type) {
        conditions.push(sql`${institutes.type} = ${params.type}`);
      }
      if (params.after) {
        const cursor = decodeCursor(params.after);
        if (cursor.id) conditions.push(sql`${institutes.id} > ${cursor.id as string}`);
      }

      const where = and(...conditions);
      const limit = params.first ?? 20;

      const [totalResult, records] = await Promise.all([
        tx.select({ value: count() }).from(institutes).where(where),
        tx
          .select(instituteColumns)
          .from(institutes)
          .where(where)
          .orderBy(asc(institutes.createdAt))
          .limit(limit),
      ]);

      return {
        records: records as InstituteRecord[],
        total: totalResult[0]?.value ?? 0,
      };
    });
  }

  async findByReseller(resellerId: string, id: string): Promise<InstituteRecord | null> {
    return withReseller(this.db, resellerId, async (tx) => {
      const rows = await tx.select(instituteColumns).from(institutes).where(eq(institutes.id, id));
      return (rows[0] as InstituteRecord | undefined) ?? null;
    });
  }

  async statistics(): Promise<InstituteStatistics> {
    return withAdmin(this.db, async (tx) => {
      const totalResult = await tx
        .select({ value: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt));

      const byStatus = await tx
        .select({ status: institutes.status, count: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt))
        .groupBy(institutes.status);

      const byType = await tx
        .select({ type: institutes.type, count: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt))
        .groupBy(institutes.type);

      const byReseller = await tx
        .select({ resellerId: institutes.resellerId, count: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt))
        .groupBy(institutes.resellerId);

      const recentResult = await tx
        .select({ value: count() })
        .from(institutes)
        .where(sql`${institutes.createdAt} > now() - interval '30 days'`);

      return {
        totalInstitutes: totalResult[0]?.value ?? 0,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
        byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
        byReseller: byReseller.map((r) => ({ resellerId: r.resellerId, count: r.count })),
        recentlyCreated: recentResult[0]?.value ?? 0,
      };
    });
  }

  async statisticsByReseller(
    resellerId: string,
  ): Promise<{ totalInstitutes: number; byStatus: Record<string, number> }> {
    return withReseller(this.db, resellerId, async (tx) => {
      const totalResult = await tx
        .select({ value: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt));

      const byStatus = await tx
        .select({ status: institutes.status, count: count() })
        .from(institutes)
        .where(isNull(institutes.deletedAt))
        .groupBy(institutes.status);

      return {
        totalInstitutes: totalResult[0]?.value ?? 0,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      };
    });
  }
}
