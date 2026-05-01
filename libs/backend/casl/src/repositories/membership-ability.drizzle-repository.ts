import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, memberships, mkAdminCtx, withAdmin } from '@roviq/database';
import { and, eq, isNull } from 'drizzle-orm';
import { MembershipAbilityRepository } from './membership-ability.repository';
import type { AbilitiesRecord } from './types';

@Injectable()
export class MembershipAbilityDrizzleRepository extends MembershipAbilityRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAbilities(userId: string, tenantId: string): Promise<AbilitiesRecord | null> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .select({ abilities: memberships.abilities })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.tenantId, tenantId),
            isNull(memberships.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    });
  }
}
