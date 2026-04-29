import { Injectable } from '@nestjs/common';
import { AbilityFactory } from '@roviq/casl';
import { InstituteRoleRepository } from './repositories/role.repository';
import type { RoleRecord } from './repositories/types';

@Injectable()
export class InstituteRoleService {
  constructor(
    private readonly repo: InstituteRoleRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  list(): Promise<RoleRecord[]> {
    return this.repo.list();
  }

  findById(id: string): Promise<RoleRecord | null> {
    return this.repo.findById(id);
  }

  async updatePrimaryNavSlugs(roleId: string, slugs: string[]): Promise<RoleRecord> {
    const updated = await this.repo.updatePrimaryNavSlugs(roleId, slugs);
    // Bust the role-abilities cache so any subsequent /me call picks up the
    // change in the same Redis tick (defensive — primary_nav_slugs lives in
    // the same row as abilities).
    await this.abilityFactory.invalidateRoleCache(roleId);
    return updated;
  }
}
