import { createMongoAbility } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import type { AbilityRule, AppAbility } from '@roviq/common-types';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';
import { MembershipAbilityRepository } from './repositories/membership-ability.repository';
import { RoleRepository } from './repositories/role.repository';

const ROLE_CACHE_PREFIX = 'casl:role:';
const ROLE_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AbilityFactory {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly roleRepo: RoleRepository,
    private readonly membershipAbilityRepo: MembershipAbilityRepository,
  ) {}

  async createForUser(user: {
    userId: string;
    scope: import('@roviq/common-types').AuthScope;
    tenantId?: string;
    membershipId: string;
    roleId: string;
  }): Promise<AppAbility> {
    // Platform admins get manage:all — no DB lookup needed
    if (user.scope === 'platform') {
      return createMongoAbility<AppAbility>([{ action: 'manage', subject: 'all' }]);
    }

    const roleAbilities = await this.getRoleAbilities(user.roleId);

    // Fetch membership-specific abilities (only for institute scope where tenantId exists)
    const membership = user.tenantId
      ? await this.membershipAbilityRepo.findAbilities(user.userId, user.tenantId)
      : null;

    const memberAbilities = (membership?.abilities as unknown as AbilityRule[] | null) ?? [];

    // Resolve placeholders in conditions (e.g., ${user.id})
    const resolvedRules = [...roleAbilities, ...memberAbilities].map((rule) =>
      this.resolveConditions(rule, user),
    );

    return createMongoAbility<AppAbility>(resolvedRules);
  }

  async getRoleAbilities(roleId: string): Promise<AbilityRule[]> {
    const cacheKey = `${ROLE_CACHE_PREFIX}${roleId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as AbilityRule[];
    }

    const role = await this.roleRepo.findAbilities(roleId);

    const abilities = (role?.abilities as unknown as AbilityRule[]) ?? [];

    await this.redis.set(cacheKey, JSON.stringify(abilities), 'EX', ROLE_CACHE_TTL);

    return abilities;
  }

  async invalidateRoleCache(roleId: string): Promise<void> {
    await this.redis.del(`${ROLE_CACHE_PREFIX}${roleId}`);
  }

  private resolveConditions(
    rule: AbilityRule,
    user: { userId: string; tenantId?: string; roleId: string },
  ): AbilityRule {
    if (!rule.conditions) return rule;

    const resolved = JSON.parse(
      JSON.stringify(rule.conditions)
        .replace(/\$\{user\.id\}/g, user.userId)
        .replace(/\$\{user\.tenantId\}/g, user.tenantId ?? ''),
    );

    return { ...rule, conditions: resolved };
  }
}
