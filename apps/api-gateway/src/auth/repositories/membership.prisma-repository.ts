import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { MembershipRepository } from './membership.repository';
import type { MembershipWithOrgAndRole, MembershipWithRole } from './types';

@Injectable()
export class MembershipPrismaRepository extends MembershipRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  findActiveByUserId(userId: string): Promise<MembershipWithOrgAndRole[]> {
    return this.prisma.membership.findMany({
      where: { userId, isActive: true },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        role: { select: { id: true, name: true, abilities: true } },
      },
    });
  }

  findByUserAndTenant(userId: string, tenantId: string): Promise<MembershipWithOrgAndRole | null> {
    return this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        role: { select: { id: true, name: true, abilities: true } },
      },
    });
  }

  findFirstActive(userId: string): Promise<MembershipWithRole | null> {
    return this.prisma.membership.findFirst({
      where: { userId, isActive: true },
      include: { role: { select: { id: true, abilities: true } } },
    });
  }
}
