import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { RefreshTokenRepository } from './refresh-token.repository';
import type { CreateRefreshTokenData, RefreshTokenWithRelations } from './types';

@Injectable()
export class RefreshTokenPrismaRepository extends RefreshTokenRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  findByIdWithRelations(id: string): Promise<RefreshTokenWithRelations | null> {
    return this.prisma.refreshToken.findUnique({
      where: { id },
      include: {
        user: true,
        membership: { include: { role: { select: { id: true, abilities: true } } } },
      },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
