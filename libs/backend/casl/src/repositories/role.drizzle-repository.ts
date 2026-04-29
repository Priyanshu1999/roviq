import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, roles, withAdmin } from '@roviq/database';
import { and, eq, isNull } from 'drizzle-orm';
import { RoleRepository } from './role.repository';
import type { AbilitiesRecord } from './types';

@Injectable()
export class RoleDrizzleRepository extends RoleRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAbilities(roleId: string): Promise<AbilitiesRecord | null> {
    return withAdmin(this.db, async (tx) => {
      const result = await tx
        .select({ abilities: roles.abilities })
        .from(roles)
        .where(and(eq(roles.id, roleId), isNull(roles.deletedAt)))
        .limit(1);

      return result[0] ?? null;
    });
  }

  async findPrimaryNavSlugs(roleId: string): Promise<string[]> {
    return withAdmin(this.db, async (tx) => {
      const [row] = await tx
        .select({ primaryNavSlugs: roles.primaryNavSlugs })
        .from(roles)
        .where(and(eq(roles.id, roleId), isNull(roles.deletedAt)))
        .limit(1);

      return row?.primaryNavSlugs ?? [];
    });
  }
}
