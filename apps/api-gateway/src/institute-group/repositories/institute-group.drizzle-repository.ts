import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessException, ErrorCode, type GroupType } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  groupMemberships,
  instituteGroups,
  instituteGroupsLive,
  institutes,
  institutesLive,
  mkAdminCtx,
  softDelete,
  withAdmin,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, asc, count, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { decodeCursor } from '../../common/pagination/relay-pagination.model';
import { InstituteGroupRepository } from './institute-group.repository';
import type {
  CreateInstituteGroupData,
  GroupMembershipRecord,
  InstituteGroupRecord,
  InstituteGroupSearchParams,
  UpdateInstituteGroupData,
} from './types';

const groupColumns = {
  id: instituteGroupsLive.id,
  name: instituteGroupsLive.name,
  code: instituteGroupsLive.code,
  type: instituteGroupsLive.type,
  registrationNumber: instituteGroupsLive.registrationNumber,
  registrationState: instituteGroupsLive.registrationState,
  contact: instituteGroupsLive.contact,
  address: instituteGroupsLive.address,
  status: instituteGroupsLive.status,
  createdBy: instituteGroupsLive.createdBy,
  createdAt: instituteGroupsLive.createdAt,
  updatedAt: instituteGroupsLive.updatedAt,
} as const;

const membershipColumns = {
  id: groupMemberships.id,
  userId: groupMemberships.userId,
  groupId: groupMemberships.groupId,
  roleId: groupMemberships.roleId,
  isActive: groupMemberships.isActive,
  createdAt: groupMemberships.createdAt,
  updatedAt: groupMemberships.updatedAt,
} as const;

@Injectable()
export class InstituteGroupDrizzleRepository extends InstituteGroupRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async search(
    params: InstituteGroupSearchParams,
  ): Promise<{ records: InstituteGroupRecord[]; total: number }> {
    const { search, status, type, first = 20, after } = params;

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const conditions: SQL[] = [];

      if (status)
        conditions.push(
          eq(instituteGroupsLive.status, status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'),
        );
      if (type) conditions.push(eq(instituteGroupsLive.type, type as GroupType));
      if (search) {
        const pattern = `%${search}%`;
        const searchCondition = or(
          ilike(instituteGroupsLive.name, pattern),
          ilike(instituteGroupsLive.code, pattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      // Cursor pagination
      if (after) {
        const cursor = decodeCursor(after);
        if (cursor.id) {
          conditions.push(sql`${instituteGroupsLive.id} > ${cursor.id as string}`);
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult, records] = await Promise.all([
        tx.select({ value: count() }).from(instituteGroupsLive).where(where),
        tx
          .select(groupColumns)
          .from(instituteGroupsLive)
          .where(where)
          .orderBy(asc(instituteGroupsLive.createdAt))
          .limit(first),
      ]);

      return {
        records: records as InstituteGroupRecord[],
        total: totalResult[0]?.value ?? 0,
      };
    });
  }

  async findById(id: string): Promise<InstituteGroupRecord | null> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .select(groupColumns)
        .from(instituteGroupsLive)
        .where(eq(instituteGroupsLive.id, id));
      return (rows[0] as InstituteGroupRecord | undefined) ?? null;
    });
  }

  async create(data: CreateInstituteGroupData): Promise<InstituteGroupRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .insert(instituteGroups)
        .values({
          name: data.name,
          code: data.code,
          type: data.type as GroupType,
          registrationNumber: data.registrationNumber,
          registrationState: data.registrationState,
          contact: data.contact ?? { phones: [], emails: [] },
          address: data.address,
          status: 'ACTIVE',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning(groupColumns);

      return rows[0] as InstituteGroupRecord;
    });
  }

  async update(id: string, data: UpdateInstituteGroupData): Promise<InstituteGroupRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .update(instituteGroups)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.registrationNumber !== undefined && {
            registrationNumber: data.registrationNumber,
          }),
          ...(data.registrationState !== undefined && {
            registrationState: data.registrationState,
          }),
          ...(data.contact !== undefined && { contact: data.contact }),
          ...(data.address !== undefined && { address: data.address }),
          version: sql`${instituteGroups.version} + 1`,
          updatedBy: userId,
        })
        .where(
          and(
            eq(instituteGroups.id, id),
            eq(instituteGroups.version, data.version),
            isNull(instituteGroups.deletedAt),
          ),
        )
        .returning(groupColumns);

      if (rows.length === 0) {
        throw new BusinessException(
          ErrorCode.CONCURRENT_MODIFICATION,
          'Record was modified by another user. Please refresh and try again.',
        );
      }
      return rows[0] as InstituteGroupRecord;
    });
  }

  async updateStatus(id: string, status: string): Promise<InstituteGroupRecord> {
    const { userId } = getRequestContext();

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .update(instituteGroups)
        .set({
          status: status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
          updatedBy: userId,
        })
        .where(and(eq(instituteGroups.id, id), isNull(instituteGroups.deletedAt)))
        .returning(groupColumns);

      if (rows.length === 0) {
        throw new NotFoundException(`Institute group ${id} not found`);
      }
      return rows[0] as InstituteGroupRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const { userId } = getRequestContext();

    await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      // Unset group_id on all associated institutes before deleting the group
      await tx
        .update(institutes)
        .set({ groupId: null, updatedBy: userId })
        .where(eq(institutes.groupId, id));

      await softDelete(tx, instituteGroups, id);
    });
  }

  async countInstitutesByGroup(groupIds: string[]): Promise<Record<string, number>> {
    if (groupIds.length === 0) return {};

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .select({ groupId: institutesLive.groupId, count: count() })
        .from(institutesLive)
        .where(inArray(institutesLive.groupId, groupIds))
        .groupBy(institutesLive.groupId);

      const result: Record<string, number> = {};
      for (const row of rows) {
        if (row.groupId) result[row.groupId] = row.count;
      }
      return result;
    });
  }

  async addInstituteToGroup(instituteId: string, groupId: string): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({ groupId })
        .where(and(eq(institutes.id, instituteId), isNull(institutes.deletedAt)))
        .returning({ id: institutes.id });

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${instituteId} not found`);
      }
    });
  }

  async removeInstituteFromGroup(instituteId: string): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .update(institutes)
        .set({ groupId: null })
        .where(and(eq(institutes.id, instituteId), isNull(institutes.deletedAt)))
        .returning({ id: institutes.id });

      if (rows.length === 0) {
        throw new NotFoundException(`Institute ${instituteId} not found`);
      }
    });
  }

  async addMember(groupId: string, userId: string, roleId: string): Promise<GroupMembershipRecord> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .insert(groupMemberships)
        .values({
          groupId,
          userId,
          roleId,
          isActive: true,
        })
        .returning(membershipColumns);

      return rows[0] as GroupMembershipRecord;
    });
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .delete(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
        .returning({ id: groupMemberships.id });

      if (rows.length === 0) {
        throw new NotFoundException(`Membership not found for user ${userId} in group ${groupId}`);
      }
    });
  }

  async findMembershipsByGroup(groupId: string): Promise<GroupMembershipRecord[]> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .select(membershipColumns)
        .from(groupMemberships)
        .where(eq(groupMemberships.groupId, groupId));

      return rows as GroupMembershipRecord[];
    });
  }

  async findMembershipsByUser(userId: string): Promise<GroupMembershipRecord[]> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .select(membershipColumns)
        .from(groupMemberships)
        .where(eq(groupMemberships.userId, userId));

      return rows as GroupMembershipRecord[];
    });
  }
}
