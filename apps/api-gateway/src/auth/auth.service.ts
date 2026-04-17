import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import { hash, verify } from '@node-rs/argon2';
import { AbilityFactory } from '@roviq/casl';
import type { AbilityRule, AuthScope } from '@roviq/common-types';
import { ResellerStatus } from '@roviq/common-types';
import type { AuthSecurityEvent } from '@roviq/notifications';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { AuthEventService } from './auth-event.service';
import type { AuthPayload, InstituteLoginResult } from './dto/auth-payload';
import type { RegisterInput } from './dto/register.input';
import { LoginLockoutService } from './login-lockout.service';
import { MembershipRepository } from './repositories/membership.repository';
import { PlatformMembershipRepository } from './repositories/platform-membership.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { ResellerMembershipRepository } from './repositories/reseller-membership.repository';
import type { UserRecord } from './repositories/types';
import { UserRepository } from './repositories/user.repository';

// ── Token payload types ──────────────────────────────────

interface AccessTokenPayload {
  sub: string;
  scope: AuthScope;
  tenantId?: string;
  resellerId?: string;
  membershipId: string;
  roleId: string;
  type: 'access';
  /** ROV-96 — first-login enforcement claim. Read by MustChangePasswordGuard via JwtStrategy. */
  mustChangePassword?: boolean;
  // Impersonation fields (optional)
  isImpersonated?: boolean;
  impersonatorId?: string;
  impersonationSessionId?: string;
}

interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  membershipId: string;
  type: 'refresh';
}

// TTL per scope (seconds)
const ACCESS_TTL_SECONDS: Record<AuthScope, number> = {
  platform: 5 * 60,
  reseller: 10 * 60,
  institute: 15 * 60,
};
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

/** ROV-96 — minimum length for a user-chosen password rotation. */
const NEW_PASSWORD_MIN_LENGTH = 12;

interface RequestMeta {
  ip?: string;
  userAgent?: string;
  deviceInfo?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userRepo: UserRepository,
    private readonly membershipRepo: MembershipRepository,
    private readonly platformMembershipRepo: PlatformMembershipRepository,
    private readonly resellerMembershipRepo: ResellerMembershipRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly authEventService: AuthEventService,
    private readonly abilityFactory: AbilityFactory,
    private readonly lockout: LoginLockoutService,
    @Inject('JETSTREAM_CLIENT') private readonly jetStreamClient: ClientProxy,
  ) {}

  // ── Registration ───────────────────────────────────────

  async register(input: RegisterInput): Promise<AuthPayload> {
    const passwordHash = await hash(input.password);
    const user = await this.userRepo.create({
      username: input.username,
      email: input.email,
      passwordHash,
    });
    return {
      user: { id: user.id, username: user.username, email: user.email },
    };
  }

  // ── Three login mutations ──────────────────────────────

  async adminLogin(username: string, password: string, meta?: RequestMeta): Promise<AuthPayload> {
    const user = await this.verifyCredentials(username, password, meta);

    const membership = await this.platformMembershipRepo.findByUserId(user.id);
    if (!membership) {
      throw new UnauthorizedException('No account found');
    }

    if (!membership.isActive) {
      throw new UnauthorizedException('No account found');
    }

    const result = await this.issueTokens({
      user,
      scope: 'platform',
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });

    if (result.user) {
      result.user.abilityRules = await this.getAbilityRules(
        user.id,
        'platform',
        undefined,
        membership.id,
        membership.roleId,
      );
    }

    this.authEventService
      .emit({
        userId: user.id,
        type: 'login_success',
        scope: 'platform',
        authMethod: 'password',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});
    this.emitLoginNotification(user.id, null, meta);

    return result;
  }

  async resellerLogin(
    username: string,
    password: string,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    const user = await this.verifyCredentials(username, password, meta);

    const memberships = await this.resellerMembershipRepo.findByUserId(user.id);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No account found');
    }

    // Check reseller is active
    const m = memberships[0];
    if (!m.reseller.isActive || m.reseller.status !== ResellerStatus.ACTIVE) {
      throw new UnauthorizedException('No account found');
    }

    const result = await this.issueTokens({
      user,
      scope: 'reseller',
      resellerId: m.resellerId,
      membershipId: m.id,
      roleId: m.roleId,
      roleAbilities: m.role.abilities as Record<string, unknown>[],
      membershipAbilities: m.abilities as Record<string, unknown>[] | null,
      meta,
    });

    this.authEventService
      .emit({
        userId: user.id,
        type: 'login_success',
        scope: 'reseller',
        resellerId: m.resellerId,
        authMethod: 'password',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});

    if (result.user) {
      result.user.abilityRules = await this.getAbilityRules(
        user.id,
        'reseller',
        undefined,
        m.id,
        m.roleId,
      );
    }
    this.emitLoginNotification(user.id, null, meta);

    return result;
  }

  async instituteLogin(
    username: string,
    password: string,
    meta?: RequestMeta,
  ): Promise<InstituteLoginResult> {
    const user = await this.verifyCredentials(username, password, meta);

    const memberships = await this.membershipRepo.findActiveByUserId(user.id);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No account found');
    }

    if (memberships.length === 1) {
      const m = memberships[0];
      const result = await this.issueTokens({
        user,
        scope: 'institute',
        tenantId: m.tenantId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });

      this.authEventService
        .emit({
          userId: user.id,
          type: 'login_success',
          scope: 'institute',
          tenantId: m.tenantId,
          authMethod: 'password',
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceInfo: meta?.deviceInfo,
        })
        .catch(() => {});

      if (result.user) {
        result.user.abilityRules = await this.getAbilityRules(
          user.id,
          'institute',
          m.tenantId,
          m.id,
          m.roleId,
        );
      }
      this.emitLoginNotification(user.id, m.tenantId, meta);

      return result;
    }

    // Multiple institutes — return membership list for picker
    const selectionToken = this.jwtService.sign(
      { sub: user.id, purpose: 'institute-selection' },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: 300 },
    );

    return {
      requiresInstituteSelection: true,
      userId: user.id,
      selectionToken,
      memberships: memberships.map((m) => ({
        membershipId: m.id,
        tenantId: m.tenantId,
        roleId: m.roleId,
        instituteName: m.institute.name,
        instituteSlug: m.institute.slug,
        instituteLogoUrl: m.institute.logoUrl ?? undefined,
        roleName: m.role.name,
      })),
    };
  }

  // ── Passkey login (no password, institute scope) ────────

  async instituteLoginByUserId(userId: string, meta?: RequestMeta): Promise<InstituteLoginResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.membershipRepo.findActiveByUserId(user.id);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No account found');
    }

    if (memberships.length === 1) {
      const m = memberships[0];
      const result = await this.issueTokens({
        user,
        scope: 'institute',
        tenantId: m.tenantId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });

      this.authEventService
        .emit({
          userId: user.id,
          type: 'login_success',
          scope: 'institute',
          tenantId: m.tenantId,
          authMethod: 'passkey',
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceInfo: meta?.deviceInfo,
        })
        .catch(() => {});

      return result;
    }

    const selectionToken = this.jwtService.sign(
      { sub: user.id, purpose: 'institute-selection' },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: 300 },
    );

    return {
      requiresInstituteSelection: true,
      userId: user.id,
      selectionToken,
      memberships: memberships.map((m) => ({
        membershipId: m.id,
        tenantId: m.tenantId,
        roleId: m.roleId,
        instituteName: m.institute.name,
        instituteSlug: m.institute.slug,
        instituteLogoUrl: m.institute.logoUrl ?? undefined,
        roleName: m.role.name,
      })),
    };
  }

  // ── Institute selection (after multi-institute login) ──

  async selectInstitute(
    selectionToken: string,
    membershipId: string,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    let userId: string;
    try {
      const payload = this.jwtService.verify(selectionToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.purpose !== 'institute-selection') {
        throw new Error('wrong purpose');
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired selection token');
    }

    const membership = await this.membershipRepo.findByIdAndUser(membershipId, userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No active membership found');
    }

    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const result = await this.issueTokens({
      user,
      scope: 'institute',
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });

    // Multi-institute login completes here (single-institute completes in
    // instituteLogin). Emit the same login-success signals so the audit
    // trail + login notification pipeline fire regardless of which path
    // the user took.
    this.authEventService
      .emit({
        userId: user.id,
        type: 'login_success',
        scope: 'institute',
        tenantId: membership.tenantId,
        authMethod: 'password',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});

    this.emitLoginNotification(user.id, membership.tenantId, meta);

    return result;
  }

  // ── Institute switching (already authenticated) ────────

  async switchInstitute(
    userId: string,
    targetMembershipId: string,
    currentRefreshToken: string,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    // ROV-92: "revoke old refresh token" — hash the raw token, find the row, revoke that ONE row
    const tokenHash = createHash('sha256').update(currentRefreshToken).digest('hex');
    const currentToken = await this.refreshTokenRepo.findByHash(tokenHash);
    if (currentToken) {
      await this.refreshTokenRepo.revoke(currentToken.id);
    }

    const membership = await this.membershipRepo.findByIdAndUser(targetMembershipId, userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No active membership for target institute');
    }

    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const result = await this.issueTokens({
      user,
      scope: 'institute',
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });

    this.authEventService
      .emit({
        userId,
        type: 'institute_switch',
        scope: 'institute',
        tenantId: membership.tenantId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
        metadata: {
          from_tenant_id: currentToken?.id,
          to_tenant_id: membership.tenantId,
        },
      })
      .catch(() => {});

    return result;
  }

  // ── Token refresh ──────────────────────────────────────

  async refreshToken(token: string, meta?: RequestMeta): Promise<AuthPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = this.hashToken(token);
    const storedToken = await this.refreshTokenRepo.findByIdWithRelations(payload.tokenId);

    // Impersonation tokens are non-renewable (Auth PRD §10.3, invariant #7).
    // The impersonation code exchange (ROV-94) never creates a refresh token,
    // so this lookup will return null. This explicit check is defense-in-depth.
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.tokenHash !== tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token reuse detection
    if (storedToken.revokedAt) {
      await this.refreshTokenRepo.revokeAllForUser(storedToken.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Password change invalidation
    const storedUser = storedToken.user;
    if (storedUser.passwordChangedAt && storedToken.createdAt < storedUser.passwordChangedAt) {
      await this.refreshTokenRepo.revoke(storedToken.id);
      throw new UnauthorizedException('Password changed — please re-authenticate');
    }

    // Refresh from a fresh DB read so the new access token reflects current
    // mustChangePassword + status. The relation user object is good enough
    // for the password-changed-at invariant above, but we want the canonical
    // record for token issuance.
    const user = (await this.userRepo.findById(storedUser.id)) ?? null;
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old token
    await this.refreshTokenRepo.revoke(storedToken.id);

    const scope = storedToken.membershipScope as AuthScope;

    // Re-issue based on scope
    let result: AuthPayload;

    if (scope === 'platform') {
      const membership = await this.platformMembershipRepo.findByUserId(user.id);
      if (!membership) {
        throw new UnauthorizedException('No active platform membership');
      }
      result = await this.issueTokens({
        user,
        scope: 'platform',
        membershipId: membership.id,
        roleId: membership.roleId,
        roleAbilities: membership.role.abilities as Record<string, unknown>[],
        membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
        meta,
      });
    } else if (scope === 'reseller') {
      const memberships = await this.resellerMembershipRepo.findByUserId(user.id);
      if (memberships.length === 0) {
        throw new UnauthorizedException('No active reseller membership');
      }
      const m = memberships[0];
      if (!m.reseller.isActive || m.reseller.status !== ResellerStatus.ACTIVE) {
        throw new UnauthorizedException('Reseller account suspended');
      }
      result = await this.issueTokens({
        user,
        scope: 'reseller',
        resellerId: m.resellerId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });
    } else if (storedToken.membership) {
      // Institute scope
      const m = storedToken.membership;
      result = await this.issueTokens({
        user,
        scope: 'institute',
        tenantId: m.tenantId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });
    } else {
      // Fallback: find first active institute membership
      const firstMembership = await this.membershipRepo.findFirstActive(user.id);
      if (!firstMembership) {
        throw new UnauthorizedException('No active memberships');
      }
      result = await this.issueTokens({
        user,
        scope: 'institute',
        tenantId: firstMembership.tenantId,
        membershipId: firstMembership.id,
        roleId: firstMembership.roleId,
        roleAbilities: firstMembership.role.abilities as Record<string, unknown>[],
        membershipAbilities: firstMembership.abilities as Record<string, unknown>[] | null,
        meta,
      });
    }

    this.authEventService
      .emit({
        userId: user.id,
        type: 'token_refresh',
        scope,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});

    return result;
  }

  // ── Logout ─────────────────────────────────────────────

  async logout(userId: string, refreshTokenId?: string, meta?: RequestMeta): Promise<void> {
    if (refreshTokenId) {
      await this.refreshTokenRepo.revoke(refreshTokenId);
    } else {
      await this.refreshTokenRepo.revokeAllForUser(userId);
    }

    this.authEventService
      .emit({
        userId,
        type: 'logout',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});
  }

  // ── Session management ─────────────────────────────────

  async getActiveSessions(userId: string) {
    return this.refreshTokenRepo.findActiveByUserId(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    // Verify the session belongs to this user
    const session = await this.refreshTokenRepo.findByIdWithRelations(sessionId);
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found');
    }
    await this.refreshTokenRepo.revoke(sessionId);
  }

  async revokeAllOtherSessions(
    userId: string,
    currentRefreshToken: string,
    meta?: RequestMeta,
  ): Promise<void> {
    const tokenHash = createHash('sha256').update(currentRefreshToken).digest('hex');
    const currentToken = await this.refreshTokenRepo.findByHash(tokenHash);
    if (!currentToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.refreshTokenRepo.revokeAllOtherForUser(userId, currentToken.id);

    this.authEventService
      .emit({
        userId,
        type: 'all_sessions_revoked',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
        metadata: { reason: 'user_initiated' },
      })
      .catch(() => {});
  }

  // ── User queries ───────────────────────────────────────

  async getUserById(id: string): Promise<UserRecord | null> {
    return this.userRepo.findById(id);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user) return false;
    return verify(user.passwordHash, password);
  }

  // ── Password change (ROV-96) ───────────────────────────

  /**
   * Rotate the authenticated user's password.
   *
   * 1. Verify current password.
   * 2. Validate new password (min length, must differ from current).
   * 3. Hash + persist; clears `must_change_password`, bumps `password_changed_at`.
   * 4. Revoke ALL refresh tokens for the user — caller must re-login on next request.
   * 5. Emit `password_change` + `all_sessions_revoked` auth events (fire-and-forget).
   *
   * Returns void on success. The resolver maps that to `Boolean!` so callers
   * always get a definitive yes/no instead of a token blob.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta?: RequestMeta,
  ): Promise<void> {
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must differ from current password');
    }
    if (newPassword.length < NEW_PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `New password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters`,
      );
    }

    // This endpoint is behind GqlAuthGuard — userId is taken from the signed
    // JWT, not from user input. A null findById result means the account was
    // deleted mid-session; it is not an enumeration surface.
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const valid = await verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await hash(newPassword);
    await this.userRepo.updatePassword(userId, newHash);
    await this.refreshTokenRepo.revokeAllForUser(userId);

    this.authEventService
      .emit({
        userId,
        type: 'password_change',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
      })
      .catch(() => {});

    this.authEventService
      .emit({
        userId,
        type: 'all_sessions_revoked',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceInfo: meta?.deviceInfo,
        metadata: { reason: 'password_change' },
      })
      .catch(() => {});
  }

  // ── Private: credential verification ───────────────────

  private async verifyCredentials(
    username: string,
    password: string,
    meta?: RequestMeta,
  ): Promise<UserRecord> {
    const usernameLower = username.toLowerCase();

    if (await this.lockout.isLocked(usernameLower)) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Too many attempts. Try again in 30 minutes.',
      });
    }

    const user = await this.userRepo.findByUsername(username);
    if (!user || user.status !== 'ACTIVE') {
      const result = await this.lockout.recordFailure(usernameLower, meta);
      this.authEventService
        .emit({
          type: 'login_failed',
          failureReason: 'invalid_credentials',
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceInfo: meta?.deviceInfo,
          metadata: { username_lower: usernameLower },
        })
        .catch(() => {});
      if (result.locked) {
        throw new UnauthorizedException({
          code: 'ACCOUNT_LOCKED',
          message: 'Too many attempts. Try again in 30 minutes.',
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      this.authEventService
        .emit({
          userId: user.id,
          type: 'login_failed',
          failureReason: 'invalid_credentials',
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceInfo: meta?.deviceInfo,
        })
        .catch(() => {});
      const result = await this.lockout.recordFailure(usernameLower, meta);
      if (result.locked) {
        throw new UnauthorizedException({
          code: 'ACCOUNT_LOCKED',
          message: 'Too many attempts. Try again in 30 minutes.',
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.lockout.clearOnSuccess(usernameLower);
    return user;
  }

  // ── Ability rules (CASL) ──────────────────────────────

  async getAbilityRules(
    userId: string,
    scope: AuthScope,
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

  // ── Login notification (NATS) ────────────────────────

  emitLoginNotification(userId: string, tenantId: string | null, meta?: RequestMeta): void {
    const event: AuthSecurityEvent = {
      tenantId,
      userId,
      eventType: 'LOGIN',
      metadata: {
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    };
    this.jetStreamClient.emit(NOTIFICATION_SUBJECTS.AUTH_SECURITY, event);
  }

  // ── Private: unified token issuance ────────────────────

  private async issueTokens(opts: {
    user: Omit<UserRecord, 'passwordHash'>;
    scope: AuthScope;
    tenantId?: string;
    resellerId?: string;
    membershipId: string;
    roleId: string;
    roleAbilities: Record<string, unknown>[];
    membershipAbilities: Record<string, unknown>[] | null;
    meta?: RequestMeta;
  }): Promise<AuthPayload> {
    const tokenId = randomUUID();

    const accessPayload: AccessTokenPayload = {
      sub: opts.user.id,
      scope: opts.scope,
      ...(opts.tenantId && { tenantId: opts.tenantId }),
      ...(opts.resellerId && { resellerId: opts.resellerId }),
      membershipId: opts.membershipId,
      roleId: opts.roleId,
      type: 'access',
      mustChangePassword: opts.user.mustChangePassword ?? false,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: opts.user.id,
      tokenId,
      membershipId: opts.membershipId,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: ACCESS_TTL_SECONDS[opts.scope],
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TTL_SECONDS,
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

    await this.refreshTokenRepo.create({
      id: tokenId,
      tokenHash,
      userId: opts.user.id,
      tenantId: opts.tenantId ?? null,
      membershipId: opts.membershipId,
      membershipScope: opts.scope,
      expiresAt,
      ipAddress: opts.meta?.ip,
      userAgent: opts.meta?.userAgent,
      deviceInfo: opts.meta?.deviceInfo,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: opts.user.id,
        username: opts.user.username,
        email: opts.user.email,
        scope: opts.scope,
        tenantId: opts.tenantId,
        resellerId: opts.resellerId,
        membershipId: opts.membershipId,
        roleId: opts.roleId,
        abilityRules: this.mergeAbilities(opts.roleAbilities, opts.membershipAbilities),
      },
    };
  }

  private mergeAbilities(
    roleAbilities: Record<string, unknown>[] | unknown,
    membershipAbilities: Record<string, unknown>[] | null | unknown,
  ): AbilityRule[] {
    const role = Array.isArray(roleAbilities) ? roleAbilities : [];
    const member = Array.isArray(membershipAbilities) ? membershipAbilities : [];
    return [...role, ...member] as AbilityRule[];
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
