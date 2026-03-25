import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  memberships,
  userProfiles,
  users,
  withAdmin,
} from '@roviq/database';
import { and, asc, count, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { AdminListUsersFilterInput } from './dto/admin-list-users-filter.input';

@Injectable()
export class AdminUserService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /** Build WHERE conditions from the filter input */
  private buildListConditions(filter: AdminListUsersFilterInput): SQL[] {
    const conditions: SQL[] = [];

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
          sql`EXISTS (
            SELECT 1 FROM phone_numbers pn
            WHERE pn.user_id = ${users.id}
            AND pn.number ILIKE ${`%${searchTerm}%`}
          )`,
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

    if (filter.status && filter.status.length > 0) {
      conditions.push(inArray(users.status, filter.status));
    }

    if (filter.hasInstituteMembership === true) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = ${users.id}
          AND m.deleted_at IS NULL
        )`,
      );
    } else if (filter.hasInstituteMembership === false) {
      conditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = ${users.id}
          AND m.deleted_at IS NULL
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
   * List users with cursor-based pagination, optional full-text search, and status filters.
   * Uses `withAdmin` for platform-level cross-tenant access.
   */
  async list(filter: AdminListUsersFilterInput) {
    return withAdmin(this.db, async (tx) => {
      const conditions = this.buildListConditions(filter);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
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

      // Batch-load memberships for all returned users
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

  /**
   * Typeahead search returning top N matches by name, username, or phone number.
   * Intended for quick-pick selectors in the admin UI.
   */
  async search(query: string, limit: number) {
    return withAdmin(this.db, async (tx) => {
      const searchTerm = query.trim();
      if (searchTerm.length === 0) return [];

      const tsQuery = searchTerm
        .split(/\s+/)
        .map((w) => `${w}:*`)
        .join(' & ');

      const rows = await tx
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
        .where(
          or(
            sql`${userProfiles.searchVector} @@ to_tsquery('simple', ${tsQuery})`,
            sql`${users.username} ILIKE ${`%${searchTerm}%`}`,
            sql`EXISTS (
              SELECT 1 FROM phone_numbers pn
              WHERE pn.user_id = ${users.id}
              AND pn.number ILIKE ${`%${searchTerm}%`}
            )`,
          ),
        )
        .orderBy(asc(users.createdAt))
        .limit(limit);

      return rows.map((row) => ({
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
        memberships: [],
      }));
    });
  }
}
