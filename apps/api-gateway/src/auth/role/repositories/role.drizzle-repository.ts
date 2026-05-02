import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  mkInstituteCtx,
  roles,
  rolesLive,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { InstituteRoleRepository } from './role.repository';
import type { RoleRecord } from './types';

const liveColumns = {
  id: rolesLive.id,
  tenantId: rolesLive.tenantId,
  name: rolesLive.name,
  isDefault: rolesLive.isDefault,
  isSystem: rolesLive.isSystem,
  primaryNavSlugs: rolesLive.primaryNavSlugs,
} as const;

@Injectable()
export class InstituteRoleDrizzleRepository extends InstituteRoleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async list(): Promise<RoleRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:role'), async (tx) => {
      return tx
        .select(liveColumns)
        .from(rolesLive)
        .where(eq(rolesLive.scope, 'institute'))
        .orderBy(asc(rolesLive.name)) as Promise<RoleRecord[]>;
    });
  }

  async findById(id: string): Promise<RoleRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:role'), async (tx) => {
      const [row] = await tx
        .select(liveColumns)
        .from(rolesLive)
        .where(eq(rolesLive.id, id))
        .limit(1);
      return (row as RoleRecord | undefined) ?? null;
    });
  }

  async updatePrimaryNavSlugs(id: string, slugs: string[]): Promise<RoleRecord> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, mkInstituteCtx(tenantId, 'repository:role'), async (tx) => {
      const [row] = await tx
        .update(roles)
        .set({ primaryNavSlugs: slugs, updatedAt: new Date() })
        .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
        .returning({
          id: roles.id,
          tenantId: roles.tenantId,
          name: roles.name,
          isDefault: roles.isDefault,
          isSystem: roles.isSystem,
          primaryNavSlugs: roles.primaryNavSlugs,
        });
      if (!row) throw new NotFoundException(`Role ${id} not found`);
      return row as RoleRecord;
    });
  }
}
