import { Inject, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ClientProxy } from '@nestjs/microservices';
import { emitAuditEvent, NoAudit } from '@roviq/audit';
import { AbilityFactory, GqlAuthGuard } from '@roviq/casl';
import type { AbilityRule, AuthUser } from '@roviq/common-types';
import type { AuthSecurityEvent } from '@roviq/notifications';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthPayload, LoginResult, UserType } from './dto/auth-payload';
import { RegisterInput } from './dto/register.input';
import { GqlAnyAuthGuard } from './guards/gql-any-auth.guard';

interface GqlContext {
  req: {
    correlationId: string;
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  };
}

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly abilityFactory: AbilityFactory,
    @Inject('JETSTREAM_CLIENT') private readonly jetStreamClient: ClientProxy,
  ) {}

  @NoAudit()
  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    const result = await this.authService.register(input);

    // Register is a platform-level action with no tenant context.
    // Audit emission is skipped — tenant_id is UUID NOT NULL, so '' would
    // fail the INSERT. The user's first tenant-scoped action (selectInstitute)
    // will be audited with a valid tenantId.

    return result;
  }

  @NoAudit()
  @Mutation(() => LoginResult)
  async login(
    @Args('username') username: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
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

    if (result.user?.tenantId) {
      this.emitAuthAudit(ctx, {
        userId: result.user.id,
        tenantId: result.user.tenantId,
        action: 'login',
        actionType: 'CREATE',
        entityType: 'Session',
        entityId: result.user.id,
      });
    }
    // Multi-institute login (no tenantId yet) skips audit — tenant_id is UUID NOT NULL.
    // selectInstitute will audit the tenant-scoped session start.

    // Emit login notification for all users (single-institute and multi-institute).
    // For multi-institute, result.user is null — resolve userId from the username.
    const loginUserId = result.user?.id ?? (await this.authService.getUserIdByUsername(username));

    if (loginUserId) {
      this.emitLoginNotification(ctx, loginUserId, result.user?.tenantId ?? null);
    }

    return result;
  }

  @NoAudit()
  @Mutation(() => AuthPayload)
  @UseGuards(GqlAnyAuthGuard)
  async selectInstitute(
    @Args('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<AuthPayload> {
    const result = await this.authService.selectInstitute(user.userId, tenantId);

    this.emitAuthAudit(ctx, {
      userId: user.userId,
      tenantId,
      action: 'selectInstitute',
      actionType: 'UPDATE',
      entityType: 'Session',
      entityId: user.userId,
    });

    return result;
  }

  @NoAudit()
  @Mutation(() => AuthPayload)
  async refreshToken(@Args('token') token: string): Promise<AuthPayload> {
    return this.authService.refreshToken(token);
  }

  @NoAudit()
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Context() ctx: GqlContext): Promise<boolean> {
    await this.authService.logout(user.userId);

    this.emitAuthAudit(ctx, {
      userId: user.userId,
      tenantId: user.tenantId,
      action: 'logout',
      actionType: 'DELETE',
      entityType: 'Session',
      entityId: user.userId,
    });

    return true;
  }

  @Query(() => UserType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<UserType> {
    const dbUser = await this.authService.getUserById(user.userId);

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

  private emitAuthAudit(
    ctx: GqlContext,
    event: {
      userId: string;
      tenantId: string;
      action: string;
      actionType: 'CREATE' | 'UPDATE' | 'DELETE';
      entityType: string;
      entityId: string;
    },
  ): void {
    const { req } = ctx;
    emitAuditEvent(this.jetStreamClient, {
      tenantId: event.tenantId,
      userId: event.userId,
      actorId: event.userId,
      action: event.action,
      actionType: event.actionType,
      entityType: event.entityType,
      entityId: event.entityId,
      changes: null,
      metadata: null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      source: 'GATEWAY',
    });
  }

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
