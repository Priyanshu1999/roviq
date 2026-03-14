import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { RoleRepository } from './role.repository';
import type { AbilitiesRecord } from './types';

@Injectable()
export class RolePrismaRepository extends RoleRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  findAbilities(roleId: string): Promise<AbilitiesRecord | null> {
    return this.prisma.role.findUnique({ where: { id: roleId }, select: { abilities: true } });
  }
}
