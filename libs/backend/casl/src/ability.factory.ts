import { createMongoAbility } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import type { AbilityRule, AppAbility } from '@roviq/common-types';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';
import { MembershipAbilityRepository } from './repositories/membership-ability.repository';
import { RoleRepository } from './repositories/role.repository';
import { substituteUserVars, type UserContext } from './substitute-user-vars';

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
    /** Optional context for variable substitution in CASL conditions */
    assignedSections?: string[];
    assignedSubjects?: string[];
    assignedDepartments?: string[];
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

    // Build substitution context from user data
    const context: UserContext = {
      userId: user.userId,
      tenantId: user.tenantId,
      assignedSections: user.assignedSections,
      assignedSubjects: user.assignedSubjects,
      assignedDepartments: user.assignedDepartments,
    };

    // Resolve $user.* placeholders in conditions using substituteUserVars
    const resolvedRules = [...roleAbilities, ...memberAbilities].map((rule) => {
      if (!rule.conditions) return rule;
      return {
        ...rule,
        conditions: substituteUserVars(rule.conditions as Record<string, unknown>, context),
      };
    });

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
}
