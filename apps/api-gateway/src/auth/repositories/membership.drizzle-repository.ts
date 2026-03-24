import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  memberships,
  roles,
  withAdmin,
} from '@roviq/database';
import { and, eq, isNull } from 'drizzle-orm';
import { MembershipRepository } from './membership.repository';
import type { MembershipWithInstituteAndRole, MembershipWithRole } from './types';

@Injectable()
export class MembershipDrizzleRepository extends MembershipRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findActiveByUserId(userId: string): Promise<MembershipWithInstituteAndRole[]> {
    const rows = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: memberships.id,
          tenantId: memberships.tenantId,
          roleId: memberships.roleId,
          status: memberships.status,
          abilities: memberships.abilities,
          instituteId: institutes.id,
          instituteName: institutes.name,
          instituteSlug: institutes.slug,
          instituteLogoUrl: institutes.logoUrl,
          roleIdFk: roles.id,
          roleName: roles.name,
          roleAbilities: roles.abilities,
        })
        .from(memberships)
        .innerJoin(institutes, eq(memberships.tenantId, institutes.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
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

  async findManyByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<MembershipWithInstituteAndRole[]> {
    const rows = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: memberships.id,
          tenantId: memberships.tenantId,
          roleId: memberships.roleId,
          status: memberships.status,
          abilities: memberships.abilities,
          instituteId: institutes.id,
          instituteName: institutes.name,
          instituteSlug: institutes.slug,
          instituteLogoUrl: institutes.logoUrl,
          roleIdFk: roles.id,
          roleName: roles.name,
          roleAbilities: roles.abilities,
        })
        .from(memberships)
        .innerJoin(institutes, eq(memberships.tenantId, institutes.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.tenantId, tenantId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
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
    const [row] = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: memberships.id,
          tenantId: memberships.tenantId,
          roleId: memberships.roleId,
          status: memberships.status,
          abilities: memberships.abilities,
          instituteId: institutes.id,
          instituteName: institutes.name,
          instituteSlug: institutes.slug,
          instituteLogoUrl: institutes.logoUrl,
          roleIdFk: roles.id,
          roleName: roles.name,
          roleAbilities: roles.abilities,
        })
        .from(memberships)
        .innerJoin(institutes, eq(memberships.tenantId, institutes.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.userId, userId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
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
    const [row] = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: memberships.id,
          tenantId: memberships.tenantId,
          roleId: memberships.roleId,
          status: memberships.status,
          abilities: memberships.abilities,
          roleIdFk: roles.id,
          roleAbilities: roles.abilities,
        })
        .from(memberships)
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
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
      role: {
        id: row.roleIdFk,
        abilities: row.roleAbilities,
      },
    };
  }
}
