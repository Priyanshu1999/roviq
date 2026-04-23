import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  resellerMemberships,
  userProfiles,
  users,
  withAdmin,
  withReseller,
} from '@roviq/database';
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { IdentityService } from '../../auth/identity.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { ResellerInviteTeamMemberInput } from './dto/reseller-invite-team-member.input';
import type { ResellerTeamFilterInput } from './dto/reseller-team-filter.input';

@Injectable()
export class ResellerTeamService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly identityService: IdentityService,
  ) {}

  /**
   * List users who hold an active reseller-scope membership in this reseller.
   * Uses `withReseller` so RLS enforces visibility to the caller's reseller.
   */
  async list(resellerId: string, filter: ResellerTeamFilterInput) {
    return withReseller(this.db, resellerId, async (tx) => {
      const searchCondition =
        filter.search && filter.search.trim().length >= 2
          ? or(
              ilike(users.username, `%${filter.search.trim()}%`),
              sql`${userProfiles.searchVector} @@ plainto_tsquery('simple', ${filter.search.trim()})`,
            )
          : undefined;

      let cursorCondition: ReturnType<typeof sql> | undefined;
      if (filter.after) {
        const cursor = decodeCursor(filter.after);
        if (cursor.id) {
          cursorCondition = sql`${resellerMemberships.id} > ${cursor.id as string}`;
        }
      }

      const where = and(
        eq(resellerMemberships.resellerId, resellerId),
        eq(resellerMemberships.isActive, true),
        searchCondition,
        cursorCondition,
      );

      const limit = filter.first ?? 20;

      const [totalResult, rows] = await Promise.all([
        tx
          .select({ value: count() })
          .from(resellerMemberships)
          .leftJoin(users, eq(users.id, resellerMemberships.userId))
          .leftJoin(userProfiles, eq(userProfiles.userId, resellerMemberships.userId))
          .where(where),
        tx
          .select({
            membershipId: resellerMemberships.id,
            roleId: resellerMemberships.roleId,
            isActive: resellerMemberships.isActive,
            membershipCreatedAt: resellerMemberships.createdAt,
            userId: users.id,
            email: users.email,
            username: users.username,
            userCreatedAt: users.createdAt,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
            profileImageUrl: userProfiles.profileImageUrl,
          })
          .from(resellerMemberships)
          .innerJoin(users, eq(users.id, resellerMemberships.userId))
          .leftJoin(userProfiles, eq(userProfiles.userId, resellerMemberships.userId))
          .where(where)
          .orderBy(asc(resellerMemberships.createdAt))
          .limit(limit + 1),
      ]);

      const hasNextPage = rows.length > limit;
      const nodes = hasNextPage ? rows.slice(0, limit) : rows;

      const edges = nodes.map((row) => ({
        node: {
          id: row.userId,
          email: row.email,
          username: row.username,
          membershipId: row.membershipId,
          roleId: row.roleId,
          isActive: row.isActive,
          createdAt: row.userCreatedAt,
          profile:
            row.firstName != null
              ? {
                  firstName: row.firstName,
                  lastName: row.lastName,
                  profileImageUrl: row.profileImageUrl,
                }
              : null,
        },
        cursor: encodeCursor({ id: row.membershipId }),
      }));

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
   * Invite a new user and immediately create their reseller-scope membership.
   * Delegates user + membership creation to IdentityService so the welcome
   * notification (temp password) is delivered via Novu automatically.
   */
  async invite(
    resellerId: string,
    actorId: string,
    input: ResellerInviteTeamMemberInput,
  ): Promise<{ membershipId: string }> {
    // Guard: the supplied roleId must belong to this reseller (not another tenant's role)
    const [roleRow] = await withAdmin(this.db, (tx) =>
      tx
        .select({ id: resellerMemberships.roleId })
        .from(resellerMemberships)
        .where(
          and(
            eq(resellerMemberships.resellerId, resellerId),
            eq(resellerMemberships.roleId, input.roleId),
          ),
        )
        .limit(1),
    );

    // If there are no existing memberships for this reseller yet, we allow the
    // first invite without the role-belongs-to-reseller check. For subsequent
    // invites the role must already be in use by this reseller.
    const membershipCount = await withReseller(this.db, resellerId, (tx) =>
      tx
        .select({ value: count() })
        .from(resellerMemberships)
        .where(eq(resellerMemberships.resellerId, resellerId))
        .then((r) => r[0]?.value ?? 0),
    );

    if (membershipCount > 0 && !roleRow) {
      throw new ForbiddenException('Supplied roleId does not belong to this reseller');
    }

    const result = await this.identityService.createUserWithMembership({
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      scope: 'reseller',
      resellerId,
      roleId: input.roleId,
      actorId,
    });

    return { membershipId: result.membershipId };
  }

  /**
   * Deactivate a team member's reseller-scope membership.
   * The user account and all other memberships remain intact.
   */
  async remove(resellerId: string, membershipId: string): Promise<void> {
    const [existing] = await withReseller(this.db, resellerId, (tx) =>
      tx
        .select({ id: resellerMemberships.id, resellerId: resellerMemberships.resellerId })
        .from(resellerMemberships)
        .where(
          and(
            eq(resellerMemberships.id, membershipId),
            eq(resellerMemberships.resellerId, resellerId),
          ),
        )
        .limit(1),
    );

    if (!existing) {
      throw new ConflictException('Team member not found in this reseller');
    }

    await withReseller(this.db, resellerId, (tx) =>
      tx
        .update(resellerMemberships)
        .set({ isActive: false })
        .where(eq(resellerMemberships.id, membershipId)),
    );
  }
}
