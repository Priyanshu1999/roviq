import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  memberships,
  refreshTokens,
  roles,
  users,
  withAdmin,
} from '@roviq/database';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { RefreshTokenRepository } from './refresh-token.repository';
import type { CreateRefreshTokenData, RefreshTokenWithRelations } from './types';

@Injectable()
export class RefreshTokenDrizzleRepository extends RefreshTokenRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async create(data: CreateRefreshTokenData): Promise<void> {
    await withAdmin(this.db, (tx) =>
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
    return withAdmin(this.db, async (tx) => {
      // Single query: token + user + optional membership + role
      const rows = await tx
        .select({
          id: refreshTokens.id,
          tokenHash: refreshTokens.tokenHash,
          userId: refreshTokens.userId,
          membershipScope: refreshTokens.membershipScope,
          revokedAt: refreshTokens.revokedAt,
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
            passwordHash: users.passwordHash,
            status: users.status,
            isPlatformAdmin: users.isPlatformAdmin,
            passwordChangedAt: users.passwordChangedAt,
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

  async findActiveByUserId(userId: string): Promise<RefreshTokenWithRelations[]> {
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select({
          id: refreshTokens.id,
          tokenHash: refreshTokens.tokenHash,
          userId: refreshTokens.userId,
          membershipScope: refreshTokens.membershipScope,
          revokedAt: refreshTokens.revokedAt,
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
            passwordHash: users.passwordHash,
            status: users.status,
            isPlatformAdmin: users.isPlatformAdmin,
            passwordChangedAt: users.passwordChangedAt,
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

  async revoke(id: string): Promise<void> {
    await withAdmin(this.db, (tx) =>
      tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id)),
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await withAdmin(this.db, (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))),
    );
  }

  async revokeAllOtherForUser(userId: string, currentTokenId: string): Promise<void> {
    await withAdmin(this.db, (tx) =>
      tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
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
