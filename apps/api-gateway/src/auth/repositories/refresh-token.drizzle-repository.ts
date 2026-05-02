import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  memberships,
  mkAdminCtx,
  refreshTokens,
  roles,
  users,
  withAdmin,
} from '@roviq/database';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { RefreshTokenRepository, type RefreshTokenRevokeReason } from './refresh-token.repository';
import type { CreateRefreshTokenData, RefreshTokenWithRelations } from './types';

/**
 * Canonical set of revoke reasons. Used by {@link coerceRevokedReason} to
 * narrow the raw `varchar` coming out of Postgres (`string | null`) into the
 * domain-level {@link RefreshTokenRevokeReason} union the rest of the code
 * expects. Single source of truth — keep in sync with the union above.
 */
const VALID_REVOKE_REASONS: ReadonlySet<RefreshTokenRevokeReason> = new Set([
  'rotation',
  'user_initiated',
  'password_change',
  'admin_revoked',
]);

/**
 * Validate and narrow a raw DB value into `RefreshTokenRevokeReason | null`.
 *
 * The single `as RefreshTokenRevokeReason` below is the ONE cast justified
 * in this file: it's gated by a runtime `Set.has` check against the canonical
 * reason list, so the cast only fires on values we've just proven to be
 * members of the union.
 *
 * Unknown non-null values collapse to `null` on purpose — the refresh flow's
 * cascade gate already treats `null` as "legacy/unknown ⇒ rotate-as-cascade",
 * which is the safest default for data we can't classify.
 */
function coerceRevokedReason(raw: string | null): RefreshTokenRevokeReason | null {
  if (raw === null) return null;
  return (VALID_REVOKE_REASONS as ReadonlySet<string>).has(raw)
    ? (raw as RefreshTokenRevokeReason)
    : null;
}

@Injectable()
export class RefreshTokenDrizzleRepository extends RefreshTokenRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async create(data: CreateRefreshTokenData): Promise<void> {
    await withAdmin(this.db, mkAdminCtx('repository:refresh-token'), (tx) =>
      tx.insert(refreshTokens).values({
        id: data.id,
        tokenHash: data.tokenHash,
        userId: data.userId,
        tenantId: data.tenantId,
        membershipId: data.membershipId,
        membershipScope: data.membershipScope,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        deviceInfo: data.deviceInfo ?? null,
      }),
    );
  }

  async findByIdWithRelations(id: string): Promise<RefreshTokenWithRelations | null> {
    return withAdmin(this.db, mkAdminCtx('repository:refresh-token'), async (tx) => {
      // Single query: token + user + optional membership + role
      const rows = await tx
        .select({
          id: refreshTokens.id,
          tokenHash: refreshTokens.tokenHash,
          userId: refreshTokens.userId,
          membershipScope: refreshTokens.membershipScope,
          revokedAt: refreshTokens.revokedAt,
          revokedReason: refreshTokens.revokedReason,
          expiresAt: refreshTokens.expiresAt,
          createdAt: refreshTokens.createdAt,
          deviceInfo: refreshTokens.deviceInfo,
          ipAddress: refreshTokens.ipAddress,
          userAgent: refreshTokens.userAgent,
          lastUsedAt: refreshTokens.lastUsedAt,
          user: {
            id: users.id,
            username: users.username,
            email: users.email,
            status: users.status,
            passwordChangedAt: users.passwordChangedAt,
            mustChangePassword: users.mustChangePassword,
          },
          membershipId: memberships.id,
          membershipTenantId: memberships.tenantId,
          membershipRoleId: memberships.roleId,
          membershipAbilities: memberships.abilities,
          roleId: roles.id,
          roleAbilities: roles.abilities,
        })
        .from(refreshTokens)
        .innerJoin(users, eq(refreshTokens.userId, users.id))
        .leftJoin(memberships, eq(refreshTokens.membershipId, memberships.id))
        .leftJoin(roles, eq(memberships.roleId, roles.id))
        .where(eq(refreshTokens.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        tokenHash: row.tokenHash,
        userId: row.userId,
        membershipScope: row.membershipScope,
        revokedAt: row.revokedAt,
        revokedReason: coerceRevokedReason(row.revokedReason),
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        deviceInfo: row.deviceInfo,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        lastUsedAt: row.lastUsedAt,
        user: row.user,
        membership:
          row.membershipId && row.membershipTenantId && row.membershipRoleId && row.roleId
            ? {
                id: row.membershipId,
                tenantId: row.membershipTenantId,
                roleId: row.membershipRoleId,
                abilities: row.membershipAbilities,
                role: {
                  id: row.roleId,
                  abilities: row.roleAbilities,
                },
              }
            : null,
      };
    });
  }

  async findByHash(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    return withAdmin(this.db, mkAdminCtx('repository:refresh-token'), async (tx) => {
      const rows = await tx
        .select({ id: refreshTokens.id, userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findActiveByUserId(userId: string): Promise<RefreshTokenWithRelations[]> {
    return withAdmin(this.db, mkAdminCtx('repository:refresh-token'), async (tx) => {
      const rows = await tx
        .select({
          id: refreshTokens.id,
          tokenHash: refreshTokens.tokenHash,
          userId: refreshTokens.userId,
          membershipScope: refreshTokens.membershipScope,
          revokedAt: refreshTokens.revokedAt,
          revokedReason: refreshTokens.revokedReason,
          expiresAt: refreshTokens.expiresAt,
          createdAt: refreshTokens.createdAt,
          deviceInfo: refreshTokens.deviceInfo,
          ipAddress: refreshTokens.ipAddress,
          userAgent: refreshTokens.userAgent,
          lastUsedAt: refreshTokens.lastUsedAt,
          user: {
            id: users.id,
            username: users.username,
            email: users.email,
            status: users.status,
            passwordChangedAt: users.passwordChangedAt,
            mustChangePassword: users.mustChangePassword,
          },
          membershipId: memberships.id,
          membershipTenantId: memberships.tenantId,
          membershipRoleId: memberships.roleId,
          membershipAbilities: memberships.abilities,
          roleId: roles.id,
          roleAbilities: roles.abilities,
        })
        .from(refreshTokens)
        .innerJoin(users, eq(refreshTokens.userId, users.id))
        .leftJoin(memberships, eq(refreshTokens.membershipId, memberships.id))
        .leftJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        );

      return rows.map((row) => ({
        id: row.id,
        tokenHash: row.tokenHash,
        userId: row.userId,
        membershipScope: row.membershipScope,
        revokedAt: row.revokedAt,
        revokedReason: coerceRevokedReason(row.revokedReason),
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        deviceInfo: row.deviceInfo,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        lastUsedAt: row.lastUsedAt,
        user: row.user,
        membership:
          row.membershipId && row.membershipTenantId && row.membershipRoleId && row.roleId
            ? {
                id: row.membershipId,
                tenantId: row.membershipTenantId,
                roleId: row.membershipRoleId,
                abilities: row.membershipAbilities,
                role: {
                  id: row.roleId,
                  abilities: row.roleAbilities,
                },
              }
            : null,
      }));
    });
  }

  async revoke(id: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await withAdmin(this.db, mkAdminCtx('repository:refresh-token'), (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(eq(refreshTokens.id, id)),
    );
  }

  async revokeAllForUser(userId: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await withAdmin(this.db, mkAdminCtx('repository:refresh-token'), (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))),
    );
  }

  async revokeAllOtherForUser(
    userId: string,
    currentTokenId: string,
    reason: RefreshTokenRevokeReason,
  ): Promise<void> {
    await withAdmin(this.db, mkAdminCtx('repository:refresh-token'), (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(
          and(
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
            ne(refreshTokens.id, currentTokenId),
          ),
        ),
    );
  }
}
