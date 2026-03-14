import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { Prisma } from '@roviq/prisma-client';
import { AuthProviderRepository } from './auth-provider.repository';
import type { AuthProviderRecord, CreatePasskeyData } from './types';

@Injectable()
export class AuthProviderPrismaRepository extends AuthProviderRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  findPasskeysByUserId(userId: string): Promise<AuthProviderRecord[]> {
    return this.prisma.authProvider.findMany({
      where: { userId, provider: 'passkey' },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByActiveUsername(username: string): Promise<AuthProviderRecord[]> {
    return this.prisma.authProvider.findMany({
      where: { provider: 'passkey', user: { username, isActive: true } },
    });
  }

  findByCredentialId(credentialId: string): Promise<AuthProviderRecord | null> {
    return this.prisma.authProvider.findFirst({
      where: { provider: 'passkey', providerUserId: credentialId },
    });
  }

  create(data: CreatePasskeyData): Promise<AuthProviderRecord> {
    return this.prisma.authProvider.create({
      data: {
        ...data,
        providerData: data.providerData as Prisma.InputJsonValue,
      },
    });
  }

  async updateProviderData(id: string, data: unknown): Promise<void> {
    await this.prisma.authProvider.update({
      where: { id },
      data: { providerData: data as Prisma.InputJsonValue },
    });
  }

  countOtherPasskeys(userId: string, excludeId: string): Promise<number> {
    return this.prisma.authProvider.count({
      where: { userId, provider: 'passkey', id: { not: excludeId } },
    });
  }

  async deletePasskey(id: string, userId: string): Promise<number> {
    const result = await this.prisma.authProvider.deleteMany({ where: { id, userId } });
    return result.count;
  }
}
