import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AbilityRule } from '@roviq/common-types';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { AbilityFactory } from '../casl/ability.factory';
import { ADMIN_PRISMA_CLIENT } from '../prisma/prisma.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthPayload, LoginResult, UserType } from './dto/auth-payload';
import { RegisterInput } from './dto/register.input';
import { GqlAnyAuthGuard } from './guards/gql-any-auth.guard';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import type { AuthUser } from './jwt.strategy';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly abilityFactory: AbilityFactory,
    @Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient,
  ) {}

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => LoginResult)
  async login(
    @Args('username') username: string,
    @Args('password') password: string,
  ): Promise<LoginResult> {
    const result = await this.authService.login(username, password);

    if (result.user?.tenantId && result.user?.roleId) {
      const rules = await this.getAbilityRules(
        result.user.id,
        result.user.tenantId,
        result.user.roleId,
      );
      result.user.abilityRules = rules as unknown as Record<string, unknown>[];
    }

    return result;
  }

  @Mutation(() => AuthPayload)
  @UseGuards(GqlAnyAuthGuard)
  async selectOrganization(
    @Args('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AuthPayload> {
    return this.authService.selectOrganization(user.userId, tenantId);
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

    if (user.tenantId && user.roleId) {
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

    return {
      id: user.userId,
      username: dbUser?.username ?? '',
      email: dbUser?.email ?? '',
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
