import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { MembershipAbilityRepository } from './membership-ability.repository';
import type { AbilitiesRecord } from './types';

@Injectable()
export class MembershipAbilityPrismaRepository extends MembershipAbilityRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  findAbilities(userId: string, tenantId: string): Promise<AbilitiesRecord | null> {
    return this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { abilities: true },
    });
  }
}
