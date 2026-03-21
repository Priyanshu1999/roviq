import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, institutes, withAdmin } from '@roviq/database';
import { and, asc, count, eq, ilike, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';
import { decodeCursor } from '../../../common/pagination/relay-pagination.model';
import { InstituteRepository } from './institute.repository';
import type {
  CreateInstituteData,
  InstituteRecord,
  InstituteSearchParams,
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
    const { search, status, type, first = 20, after } = params;

    return withAdmin(this.db, async (tx) => {
      const conditions: SQL[] = [isNull(institutes.deletedAt)];

      if (status)
        conditions.push(
          eq(
            institutes.status,
            status as 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED',
          ),
        );
      if (type) conditions.push(eq(institutes.type, type as 'SCHOOL' | 'COACHING' | 'LIBRARY'));
      if (search) {
        const pattern = `%${search}%`;
        const searchCondition = or(
          ilike(institutes.slug, pattern),
          ilike(institutes.code, pattern),
          sql`${institutes.name}::text ILIKE ${pattern}`,
        );
        if (searchCondition) conditions.push(searchCondition);
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
