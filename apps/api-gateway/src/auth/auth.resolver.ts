import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AbilityRule } from '@roviq/common-types';
import type { PrismaClient } from '@roviq/prisma-client';
import { AbilityFactory } from '../casl/ability.factory';
import { ADMIN_PRISMA_CLIENT } from '../prisma/prisma.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthPayload, UserType } from './dto/auth-payload';
import { RegisterInput } from './dto/register.input';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import type { AuthUser } from './jwt.strategy';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly abilityFactory: AbilityFactory,
    @Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload)
  async login(
    @Args('username') username: string,
    @Args('password') password: string,
    @Args('tenantId') tenantId: string,
  ): Promise<AuthPayload> {
    const payload = await this.authService.login(username, password, tenantId);

    const rules = await this.getAbilityRules(payload.user.id, tenantId, payload.user.roleId ?? '');
    payload.user.abilityRules = rules as unknown as Record<string, unknown>[];

    return payload;
  }

  @Mutation(() => AuthPayload)
  async refreshToken(@Args('token') token: string): Promise<AuthPayload> {
    return this.authService.refreshToken(token);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(@CurrentUser() user: AuthUser): Promise<boolean> {
    await this.authService.logout(user.userId);
    return true;
  }

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<UserType> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    const rules = await this.getAbilityRules(user.userId, user.tenantId, user.roleId);

    return {
      id: user.userId,
      username: dbUser?.username ?? '',
      email: dbUser?.email ?? '',
      tenantId: user.tenantId,
      roleId: user.roleId,
      abilityRules: rules as unknown as Record<string, unknown>[],
    };
  }

  private async getAbilityRules(
    userId: string,
    tenantId: string,
    roleId: string,
  ): Promise<AbilityRule[]> {
    const ability = await this.abilityFactory.createForUser({
      userId,
      tenantId,
      roleId,
    });
    return ability.rules as AbilityRule[];
  }
}
