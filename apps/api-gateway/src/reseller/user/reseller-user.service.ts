import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  memberships,
  userProfiles,
  users,
  withReseller,
} from '@roviq/database';
import { and, asc, count, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { ResellerListUsersFilterInput } from './dto/reseller-list-users-filter.input';

@Injectable()
export class ResellerUserService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /** Build WHERE conditions from the filter input, starting with the reseller-scoped base condition */
  private buildListConditions(filter: ResellerListUsersFilterInput): SQL[] {
    // Base condition: users who have at least one membership in the reseller's institutes.
    // The `withReseller` context ensures `institutes` RLS restricts to this reseller's institutes.
    const userSubquery = sql`EXISTS (
      SELECT 1 FROM memberships m
      INNER JOIN institutes i ON i.id = m.tenant_id
      WHERE m.user_id = ${users.id}
      AND m.deleted_at IS NULL
      AND i.deleted_at IS NULL
    )`;

    const conditions: SQL[] = [userSubquery];

    if (filter.search) {
      const searchTerm = filter.search.trim();
      if (searchTerm.length >= 2) {
        const tsQuery = searchTerm
          .split(/\s+/)
          .map((w) => `${w}:*`)
          .join(' & ');
        const searchCondition = or(
          sql`${userProfiles.searchVector} @@ to_tsquery('simple', ${tsQuery})`,
          sql`${users.username} ILIKE ${`%${searchTerm}%`}`,
        );
        if (searchCondition) conditions.push(searchCondition);
      } else {
        const pattern = `%${searchTerm}%`;
        const searchCondition = or(
          sql`${userProfiles.firstName} ILIKE ${pattern}`,
          sql`${users.username} ILIKE ${pattern}`,
        );
        if (searchCondition) conditions.push(searchCondition);
      }
    }

    if (filter.instituteId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = ${users.id}
          AND m.tenant_id = ${filter.instituteId}
          AND m.deleted_at IS NULL
        )`,
      );
    }

    if (filter.membershipStatus && filter.membershipStatus.length > 0) {
      const statusList = filter.membershipStatus.map((s) => `'${s}'`).join(',');
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM memberships m
          INNER JOIN institutes i ON i.id = m.tenant_id
          WHERE m.user_id = ${users.id}
          AND m.deleted_at IS NULL
          AND i.deleted_at IS NULL
          AND m.status IN (${sql.raw(statusList)})
        )`,
      );
    }

    if (filter.after) {
      const cursor = decodeCursor(filter.after);
      if (cursor.id) {
        conditions.push(sql`${users.id} > ${cursor.id as string}`);
      }
    }

    return conditions;
  }

  /**
   * List users who have memberships in institutes belonging to this reseller.
   * Uses `withReseller` so RLS scopes visibility to the reseller's institutes only.
   */
  async list(resellerId: string, filter: ResellerListUsersFilterInput) {
    return withReseller(this.db, resellerId, async (tx) => {
      const conditions = this.buildListConditions(filter);
      const where = and(...conditions);
      const limit = filter.first ?? 20;

      // Fetch users with left-joined profile
      const [totalResult, userRows] = await Promise.all([
        tx
          .select({ value: count() })
          .from(users)
          .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(where),
        tx
          .select({
            id: users.id,
            email: users.email,
            username: users.username,
            status: users.status,
            createdAt: users.createdAt,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
            nameLocal: userProfiles.nameLocal,
            profileImageUrl: userProfiles.profileImageUrl,
          })
          .from(users)
          .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(where)
          .orderBy(asc(users.createdAt))
          .limit(limit + 1),
      ]);

      const hasNextPage = userRows.length > limit;
      const nodes = hasNextPage ? userRows.slice(0, limit) : userRows;

      // Batch-load memberships scoped to this reseller's institutes
      const userIds = nodes.map((u) => u.id);
      const membershipRows =
        userIds.length > 0
          ? await tx
              .select({
                id: memberships.id,
                userId: memberships.userId,
                tenantId: memberships.tenantId,
                roleId: memberships.roleId,
                status: memberships.status,
                instituteName: institutes.name,
              })
              .from(memberships)
              .innerJoin(institutes, eq(institutes.id, memberships.tenantId))
              .where(and(inArray(memberships.userId, userIds), isNull(memberships.deletedAt)))
          : [];

      // Group memberships by userId
      const membershipsByUser = new Map<string, typeof membershipRows>();
      for (const row of membershipRows) {
        const existing = membershipsByUser.get(row.userId) ?? [];
        existing.push(row);
        membershipsByUser.set(row.userId, existing);
      }

      const edges = nodes.map((row) => {
        const userMemberships = membershipsByUser.get(row.id) ?? [];
        return {
          node: {
            id: row.id,
            email: row.email,
            username: row.username,
            status: row.status,
            createdAt: row.createdAt,
            profile: row.firstName
              ? {
                  firstName: row.firstName,
                  lastName: row.lastName,
                  nameLocal: row.nameLocal,
                  profileImageUrl: row.profileImageUrl,
                }
              : null,
            memberships: userMemberships.map((m) => ({
              id: m.id,
              tenantId: m.tenantId,
              roleId: m.roleId,
              status: m.status,
              instituteName: (m.instituteName as Record<string, string> | null)?.en ?? null,
            })),
          },
          cursor: encodeCursor({ id: row.id }),
        };
      });

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!filter.after,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount: totalResult[0]?.value ?? 0,
      };
    });
  }
}
