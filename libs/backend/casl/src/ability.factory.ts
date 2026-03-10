import { createMongoAbility } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import type { AbilityRule, AppAbility } from '@roviq/common-types';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';

const ROLE_CACHE_PREFIX = 'casl:role:';
const ROLE_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AbilityFactory {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient,
  ) {}

  async createForUser(user: {
    userId: string;
    tenantId: string;
    roleId: string;
  }): Promise<AppAbility> {
    const roleAbilities = await this.getRoleAbilities(user.roleId);

    // Fetch membership-specific abilities
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.userId, tenantId: user.tenantId } },
      select: { abilities: true },
    });

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

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { abilities: true },
    });

    const abilities = (role?.abilities as unknown as AbilityRule[]) ?? [];

    await this.redis.set(cacheKey, JSON.stringify(abilities), 'EX', ROLE_CACHE_TTL);

    return abilities;
  }

  async invalidateRoleCache(roleId: string): Promise<void> {
    await this.redis.del(`${ROLE_CACHE_PREFIX}${roleId}`);
  }

  private resolveConditions(
    rule: AbilityRule,
    user: { userId: string; tenantId: string; roleId: string },
  ): AbilityRule {
    if (!rule.conditions) return rule;

    const resolved = JSON.parse(
      JSON.stringify(rule.conditions)
        .replace(/\$\{user\.id\}/g, user.userId)
        .replace(/\$\{user\.tenantId\}/g, user.tenantId),
    );

    return { ...rule, conditions: resolved };
  }
}
