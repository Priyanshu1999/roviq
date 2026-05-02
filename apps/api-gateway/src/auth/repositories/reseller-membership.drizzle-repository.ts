import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  mkAdminCtx,
  resellerMemberships,
  resellers,
  roles,
  withAdmin,
} from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import { ResellerMembershipRepository } from './reseller-membership.repository';
import type { ResellerMembershipWithResellerAndRole } from './types';

@Injectable()
export class ResellerMembershipDrizzleRepository extends ResellerMembershipRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findByUserId(userId: string): Promise<ResellerMembershipWithResellerAndRole[]> {
    const rows = await withAdmin(this.db, mkAdminCtx('repository:reseller-membership'), (tx) =>
      tx
        .select({
          id: resellerMemberships.id,
          userId: resellerMemberships.userId,
          resellerId: resellerMemberships.resellerId,
          roleId: resellerMemberships.roleId,
          isActive: resellerMemberships.isActive,
          abilities: resellerMemberships.abilities,
          resellerIdFk: resellers.id,
          resellerName: resellers.name,
          resellerSlug: resellers.slug,
          resellerIsActive: resellers.isActive,
          resellerStatus: resellers.status,
          roleIdFk: roles.id,
          roleAbilities: roles.abilities,
        })
        .from(resellerMemberships)
        .innerJoin(resellers, eq(resellerMemberships.resellerId, resellers.id))
        .innerJoin(roles, eq(resellerMemberships.roleId, roles.id))
        .where(and(eq(resellerMemberships.userId, userId), eq(resellerMemberships.isActive, true))),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      resellerId: row.resellerId,
      roleId: row.roleId,
      isActive: row.isActive,
      abilities: row.abilities,
      reseller: {
        id: row.resellerIdFk,
        name: row.resellerName,
        slug: row.resellerSlug,
        isActive: row.resellerIsActive,
        status: row.resellerStatus,
      },
      role: { id: row.roleIdFk, abilities: row.roleAbilities },
    }));
  }

  async findByUserAndReseller(
    userId: string,
    resellerId: string,
  ): Promise<ResellerMembershipWithResellerAndRole | null> {
    const rows = await this.findByUserId(userId);
    return rows.find((r) => r.resellerId === resellerId) ?? null;
  }
}
