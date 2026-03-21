import { Inject, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ClientProxy } from '@nestjs/microservices';
import { NoAudit } from '@roviq/audit';
import { CurrentUser, GqlAuthGuard } from '@roviq/auth-backend';
import { AbilityFactory } from '@roviq/casl';
import type { AbilityRule, AuthUser } from '@roviq/common-types';
import type { AuthSecurityEvent } from '@roviq/notifications';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { AuthService } from './auth.service';
import { AuthPayload, InstituteLoginResult, SessionInfo, UserType } from './dto/auth-payload';
import { RegisterInput } from './dto/register.input';

interface GqlContext {
  req: {
    correlationId: string;
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  };
}

function extractMeta(ctx: GqlContext) {
  return {
    ip: ctx.req.ip,
    userAgent: ctx.req.headers['user-agent'] as string | undefined,
  };
}

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly abilityFactory: AbilityFactory,
    @Inject('JETSTREAM_CLIENT') private readonly jetStreamClient: ClientProxy,
  ) {}

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
    const result = await this.authService.adminLogin(username, password, extractMeta(ctx));

    if (result.user) {
      const rules = await this.getAbilityRules(
        result.user.id,
        'platform',
        undefined,
        '',
        result.user.roleId ?? '',
      );
      result.user.abilityRules = rules as unknown as Record<string, unknown>[];
    }

    this.emitLoginNotification(ctx, result.user?.id ?? '', null);
    return result;
  }

  @NoAudit()
  @Mutation(() => AuthPayload)
  async resellerLogin(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    const result = await this.authService.resellerLogin(username, password, extractMeta(ctx));

    if (result.user) {
      const rules = await this.getAbilityRules(
        result.user.id,
        'reseller',
        undefined,
        '',
        result.user.roleId ?? '',
      );
      result.user.abilityRules = rules as unknown as Record<string, unknown>[];
    }

    this.emitLoginNotification(ctx, result.user?.id ?? '', null);
    return result;
  }

  @NoAudit()
  @Mutation(() => InstituteLoginResult)
  async instituteLogin(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<InstituteLoginResult> {
    const result = await this.authService.instituteLogin(username, password, extractMeta(ctx));

    if (result.user?.tenantId && result.user?.roleId) {
      const rules = await this.getAbilityRules(
        result.user.id,
        'institute',
        result.user.tenantId,
        '',
        result.user.roleId,
      );
      result.user.abilityRules = rules as unknown as Record<string, unknown>[];
    }

    const loginUserId = result.user?.id ?? result.userId;
    if (loginUserId) {
      this.emitLoginNotification(ctx, loginUserId, result.user?.tenantId ?? null);
    }

    return result;
  }

  // ── Institute selection (multi-institute flow) ─────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  @UseGuards(GqlAuthGuard)
  async selectInstitute(
    @Args('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.selectInstitute(user.userId, membershipId, extractMeta(ctx));
  }

  // ── Institute switching ────────────────────────────────

  @NoAudit()
  @Mutation(() => AuthPayload)
  @UseGuards(GqlAuthGuard)
  async switchInstitute(
    @Args('membershipId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    return this.authService.switchInstitute(
      user.userId,
      membershipId,
      undefined, // currentRefreshTokenId — will be passed via header in future
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
      isCurrent: false, // will be refined when tokenId is available from context
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
  async revokeAllOtherSessions(@CurrentUser() user: AuthUser): Promise<boolean> {
    // user.membershipId is the current session's membership, not the token ID
    // For now, revoke all — will be refined when tokenId is available from context
    await this.authService.revokeAllOtherSessions(user.userId, user.membershipId);
    return true;
  }

  // ── Me query ───────────────────────────────────────────

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<UserType> {
    const dbUser = await this.authService.getUserById(user.userId);

    const rules = await this.getAbilityRules(
      user.userId,
      user.scope,
      user.tenantId,
      user.membershipId,
      user.roleId,
    );

    return {
      id: user.userId,
      username: dbUser?.username ?? '',
      email: dbUser?.email ?? '',
      scope: user.scope,
      tenantId: user.tenantId,
      roleId: user.roleId,
      abilityRules: rules as unknown as Record<string, unknown>[],
    };
  }

  // ── Private helpers ────────────────────────────────────

  private emitLoginNotification(ctx: GqlContext, userId: string, tenantId: string | null): void {
    const event: AuthSecurityEvent = {
      tenantId,
      userId,
      eventType: 'LOGIN',
      metadata: {
        ip: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
      },
    };
    this.jetStreamClient.emit(NOTIFICATION_SUBJECTS.AUTH_SECURITY, event);
  }

  private async getAbilityRules(
    userId: string,
    scope: import('@roviq/common-types').AuthScope,
    tenantId: string | undefined,
    membershipId: string,
    roleId: string,
  ): Promise<AbilityRule[]> {
    const ability = await this.abilityFactory.createForUser({
      userId,
      scope,
      tenantId,
      membershipId,
      roleId,
    });
    return ability.rules as AbilityRule[];
  }
}
