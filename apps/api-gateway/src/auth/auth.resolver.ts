import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NoAudit } from '@roviq/audit';
import { assertTenantContext, CurrentUser, GqlAuthGuard } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { AuthService } from './auth.service';
import { AllowWhenPasswordChangeRequired } from './decorators/allow-when-password-change-required.decorator';
import { AuthPayload, InstituteLoginResult, SessionInfo, UserType } from './dto/auth-payload';
import { RegisterInput } from './dto/register.input';
import { extractMeta, type GqlContext } from './gql-context';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  // ── Registration ───────────────────────────────────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  // ── Three login mutations ──────────────────────────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  async adminLogin(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.adminLogin(username, password, extractMeta(ctx));
  }

  @NoAudit()
  @Mutation(() => AuthPayload)
  async resellerLogin(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.resellerLogin(username, password, extractMeta(ctx));
  }

  @NoAudit()
  @Mutation(() => InstituteLoginResult)
  async instituteLogin(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<InstituteLoginResult> {
    return this.authService.instituteLogin(username, password, extractMeta(ctx));
  }

  // ── Institute selection (multi-institute flow) ─────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  async selectInstitute(
    @Args('selectionToken') selectionToken: string,
    @Args('membershipId') membershipId: string,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.selectInstitute(selectionToken, membershipId, extractMeta(ctx));
  }

  // ── Institute switching ────────────────────────────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  @UseGuards(GqlAuthGuard)
  async switchInstitute(
    @Args('membershipId') membershipId: string,
    @Args('currentRefreshToken') currentRefreshToken: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.switchInstitute(
      user.userId,
      membershipId,
      currentRefreshToken,
      extractMeta(ctx),
    );
  }

  // ── Token refresh ──────────────────────────────────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  async refreshToken(
    @Args('token') token: string,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.refreshToken(token, extractMeta(ctx));
  }

  // ── Logout ─────────────────────────────────────────────

  @NoAudit()
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @AllowWhenPasswordChangeRequired()
  async logout(@CurrentUser() user: AuthUser): Promise<boolean> {
    await this.authService.logout(user.userId);
    return true;
  }

  // ── Session management ─────────────────────────────────

  @Query(() => [SessionInfo])
  @UseGuards(GqlAuthGuard)
  async mySessions(@CurrentUser() user: AuthUser): Promise<SessionInfo[]> {
    const sessions = await this.authService.getActiveSessions(user.userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo ?? undefined,
      ipAddress: s.ipAddress ?? undefined,
      userAgent: s.userAgent ?? undefined,
      lastUsedAt: s.lastUsedAt ?? undefined,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: false,
    }));
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async revokeSession(
    @Args('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    await this.authService.revokeSession(user.userId, sessionId);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async revokeAllOtherSessions(
    @Args('currentRefreshToken') currentRefreshToken: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<boolean> {
    await this.authService.revokeAllOtherSessions(
      user.userId,
      currentRefreshToken,
      extractMeta(ctx),
    );
    return true;
  }

  // ── Password change (ROV-96) ───────────────────────────

  @NoAudit()
  @Mutation(() => Boolean, {
    description:
      'Rotate the authenticated user password. Revokes ALL sessions (caller must re-login). Allowed even when must_change_password is set so first-login enforcement can complete.',
  })
  @UseGuards(GqlAuthGuard)
  @AllowWhenPasswordChangeRequired()
  async changePassword(
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<boolean> {
    await this.authService.changePassword(
      user.userId,
      currentPassword,
      newPassword,
      extractMeta(ctx),
    );
    return true;
  }

  // ── Me query ───────────────────────────────────────────

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  @AllowWhenPasswordChangeRequired()
  async me(@CurrentUser() user: AuthUser): Promise<UserType> {
    assertTenantContext(user);
    const dbUser = await this.authService.getUserById(user.userId);
    const abilityRules = await this.authService.getAbilityRules(
      user.userId,
      user.scope,
      user.tenantId,
      user.membershipId,
      user.roleId,
    );
    const primaryNavSlugs = await this.authService.getPrimaryNavSlugs(user.roleId);

    return {
      id: user.userId,
      username: dbUser?.username ?? '',
      email: dbUser?.email ?? '',
      scope: user.scope,
      tenantId: user.tenantId,
      roleId: user.roleId,
      abilityRules,
      primaryNavSlugs,
    };
  }
}
