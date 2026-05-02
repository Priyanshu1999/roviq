import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  mkAdminCtx,
  platformMemberships,
  roles,
  withAdmin,
} from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import { PlatformMembershipRepository } from './platform-membership.repository';
import type { PlatformMembershipWithRole } from './types';

@Injectable()
export class PlatformMembershipDrizzleRepository extends PlatformMembershipRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findByUserId(userId: string): Promise<PlatformMembershipWithRole | null> {
    const [row] = await withAdmin(this.db, mkAdminCtx('repository:platform-membership'), (tx) =>
      tx
        .select({
          id: platformMemberships.id,
          userId: platformMemberships.userId,
          roleId: platformMemberships.roleId,
          isActive: platformMemberships.isActive,
          abilities: platformMemberships.abilities,
          roleIdFk: roles.id,
          roleAbilities: roles.abilities,
        })
        .from(platformMemberships)
        .innerJoin(roles, eq(platformMemberships.roleId, roles.id))
        .where(and(eq(platformMemberships.userId, userId), eq(platformMemberships.isActive, true)))
        .limit(1),
    );

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      roleId: row.roleId,
      isActive: row.isActive,
      abilities: row.abilities,
      role: { id: row.roleIdFk, abilities: row.roleAbilities },
    };
  }
}
