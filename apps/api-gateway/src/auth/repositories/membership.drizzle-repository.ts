import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutesLive,
  membershipsLive,
  mkAdminCtx,
  rolesLive,
  withAdmin,
} from '@roviq/database';
import { and, asc, eq } from 'drizzle-orm';
import { MembershipRepository } from './membership.repository';
import type { MembershipWithInstituteAndRole, MembershipWithRole } from './types';

@Injectable()
export class MembershipDrizzleRepository extends MembershipRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findActiveByUserId(userId: string): Promise<MembershipWithInstituteAndRole[]> {
    const rows = await withAdmin(this.db, mkAdminCtx('repository:membership'), (tx) =>
      tx
        .select({
          id: membershipsLive.id,
          tenantId: membershipsLive.tenantId,
          roleId: membershipsLive.roleId,
          status: membershipsLive.status,
          abilities: membershipsLive.abilities,
          instituteId: institutesLive.id,
          instituteName: institutesLive.name,
          instituteSlug: institutesLive.slug,
          instituteLogoUrl: institutesLive.logoUrl,
          roleIdFk: rolesLive.id,
          roleName: rolesLive.name,
          roleAbilities: rolesLive.abilities,
        })
        .from(membershipsLive)
        .innerJoin(institutesLive, eq(membershipsLive.tenantId, institutesLive.id))
        .innerJoin(rolesLive, eq(membershipsLive.roleId, rolesLive.id))
        .where(and(eq(membershipsLive.userId, userId), eq(membershipsLive.status, 'ACTIVE')))
        // Deterministic order — multi-institute admins see memberships in
        // creation order across requests; selection-step UI / e2e tests
        // can rely on a stable index.
        .orderBy(asc(membershipsLive.createdAt), asc(membershipsLive.id)),
    );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      status: row.status,
      abilities: row.abilities,
      institute: {
        id: row.instituteId,
        name: row.instituteName,
        slug: row.instituteSlug,
        logoUrl: row.instituteLogoUrl,
      },
      role: {
        id: row.roleIdFk,
        name: row.roleName,
        abilities: row.roleAbilities,
      },
    }));
  }

  async findManyByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<MembershipWithInstituteAndRole[]> {
    const rows = await withAdmin(this.db, mkAdminCtx('repository:membership'), (tx) =>
      tx
        .select({
          id: membershipsLive.id,
          tenantId: membershipsLive.tenantId,
          roleId: membershipsLive.roleId,
          status: membershipsLive.status,
          abilities: membershipsLive.abilities,
          instituteId: institutesLive.id,
          instituteName: institutesLive.name,
          instituteSlug: institutesLive.slug,
          instituteLogoUrl: institutesLive.logoUrl,
          roleIdFk: rolesLive.id,
          roleName: rolesLive.name,
          roleAbilities: rolesLive.abilities,
        })
        .from(membershipsLive)
        .innerJoin(institutesLive, eq(membershipsLive.tenantId, institutesLive.id))
        .innerJoin(rolesLive, eq(membershipsLive.roleId, rolesLive.id))
        .where(
          and(
            eq(membershipsLive.userId, userId),
            eq(membershipsLive.tenantId, tenantId),
            eq(membershipsLive.status, 'ACTIVE'),
          ),
        ),
    );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      status: row.status,
      abilities: row.abilities,
      institute: {
        id: row.instituteId,
        name: row.instituteName,
        slug: row.instituteSlug,
        logoUrl: row.instituteLogoUrl,
      },
      role: {
        id: row.roleIdFk,
        name: row.roleName,
        abilities: row.roleAbilities,
      },
    }));
  }

  async findByIdAndUser(
    membershipId: string,
    userId: string,
  ): Promise<MembershipWithInstituteAndRole | null> {
    const [row] = await withAdmin(this.db, mkAdminCtx('repository:membership'), (tx) =>
      tx
        .select({
          id: membershipsLive.id,
          tenantId: membershipsLive.tenantId,
          roleId: membershipsLive.roleId,
          status: membershipsLive.status,
          abilities: membershipsLive.abilities,
          instituteId: institutesLive.id,
          instituteName: institutesLive.name,
          instituteSlug: institutesLive.slug,
          instituteLogoUrl: institutesLive.logoUrl,
          roleIdFk: rolesLive.id,
          roleName: rolesLive.name,
          roleAbilities: rolesLive.abilities,
        })
        .from(membershipsLive)
        .innerJoin(institutesLive, eq(membershipsLive.tenantId, institutesLive.id))
        .innerJoin(rolesLive, eq(membershipsLive.roleId, rolesLive.id))
        .where(
          and(
            eq(membershipsLive.id, membershipId),
            eq(membershipsLive.userId, userId),
            eq(membershipsLive.status, 'ACTIVE'),
          ),
        )
        .limit(1),
    );

    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      status: row.status,
      abilities: row.abilities,
      institute: {
        id: row.instituteId,
        name: row.instituteName,
        slug: row.instituteSlug,
        logoUrl: row.instituteLogoUrl,
      },
      role: {
        id: row.roleIdFk,
        name: row.roleName,
        abilities: row.roleAbilities,
      },
    };
  }

  async findFirstActive(userId: string): Promise<MembershipWithRole | null> {
    const [row] = await withAdmin(this.db, mkAdminCtx('repository:membership'), (tx) =>
      tx
        .select({
          id: membershipsLive.id,
          tenantId: membershipsLive.tenantId,
          roleId: membershipsLive.roleId,
          status: membershipsLive.status,
          abilities: membershipsLive.abilities,
          roleIdFk: rolesLive.id,
          roleAbilities: rolesLive.abilities,
        })
        .from(membershipsLive)
        .innerJoin(rolesLive, eq(membershipsLive.roleId, rolesLive.id))
        .where(and(eq(membershipsLive.userId, userId), eq(membershipsLive.status, 'ACTIVE')))
        .limit(1),
    );

    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      status: row.status,
      abilities: row.abilities,
      role: {
        id: row.roleIdFk,
        abilities: row.roleAbilities,
      },
    };
  }
}
