import { createHash } from 'node:crypto';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { AuthScope } from '@roviq/common-types';
import { v4 as uuidv4 } from 'uuid';
import type { AuthPayload, InstituteLoginResult } from './dto/auth-payload';
import type { RegisterInput } from './dto/register.input';
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
    const user = await this.verifyCredentials(username, password);

    const membership = await this.platformMembershipRepo.findByUserId(user.id);
    if (!membership) {
      throw new UnauthorizedException('No account found');
    }

    return this.issueTokens({
      user,
      scope: 'platform',
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });
  }

  async resellerLogin(
    username: string,
    password: string,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    const user = await this.verifyCredentials(username, password);

    const memberships = await this.resellerMembershipRepo.findByUserId(user.id);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No account found');
    }

    // Check reseller is active
    const m = memberships[0];
    if (!m.reseller.isActive || m.reseller.status !== 'active') {
      throw new UnauthorizedException('No account found');
    }

    return this.issueTokens({
      user,
      scope: 'reseller',
      resellerId: m.resellerId,
      membershipId: m.id,
      roleId: m.roleId,
      roleAbilities: m.role.abilities as Record<string, unknown>[],
      membershipAbilities: m.abilities as Record<string, unknown>[] | null,
      meta,
    });
  }

  async instituteLogin(
    username: string,
    password: string,
    meta?: RequestMeta,
  ): Promise<InstituteLoginResult> {
    const user = await this.verifyCredentials(username, password);

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
      return result;
    }

    // Multiple institutes — return membership list for picker
    return {
      requiresInstituteSelection: true,
      userId: user.id,
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
      return this.issueTokens({
        user,
        scope: 'institute',
        tenantId: m.tenantId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });
    }

    return {
      requiresInstituteSelection: true,
      userId: user.id,
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
    userId: string,
    membershipId: string,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    const membership = await this.membershipRepo.findByUserAndTenant(userId, membershipId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No active membership found');
    }

    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.issueTokens({
      user,
      scope: 'institute',
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });
  }

  // ── Institute switching (already authenticated) ────────

  async switchInstitute(
    userId: string,
    targetMembershipId: string,
    currentRefreshTokenId: string | undefined,
    meta?: RequestMeta,
  ): Promise<AuthPayload> {
    // Revoke the current refresh token
    if (currentRefreshTokenId) {
      await this.refreshTokenRepo.revoke(currentRefreshTokenId);
    }

    const membership = await this.membershipRepo.findByUserAndTenant(userId, targetMembershipId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No active membership for target institute');
    }

    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.issueTokens({
      user,
      scope: 'institute',
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleAbilities: membership.role.abilities as Record<string, unknown>[],
      membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
      meta,
    });
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
    const user = storedToken.user;
    if (user.passwordChangedAt && storedToken.createdAt < user.passwordChangedAt) {
      await this.refreshTokenRepo.revoke(storedToken.id);
      throw new UnauthorizedException('Password changed — please re-authenticate');
    }

    // Revoke old token
    await this.refreshTokenRepo.revoke(storedToken.id);

    const scope = storedToken.membershipScope as AuthScope;

    // Re-issue based on scope
    if (scope === 'platform') {
      const membership = await this.platformMembershipRepo.findByUserId(user.id);
      if (!membership) {
        throw new UnauthorizedException('No active platform membership');
      }
      return this.issueTokens({
        user,
        scope: 'platform',
        membershipId: membership.id,
        roleId: membership.roleId,
        roleAbilities: membership.role.abilities as Record<string, unknown>[],
        membershipAbilities: membership.abilities as Record<string, unknown>[] | null,
        meta,
      });
    }

    if (scope === 'reseller') {
      const memberships = await this.resellerMembershipRepo.findByUserId(user.id);
      if (memberships.length === 0) {
        throw new UnauthorizedException('No active reseller membership');
      }
      const m = memberships[0];
      if (!m.reseller.isActive || m.reseller.status !== 'active') {
        throw new UnauthorizedException('Reseller account suspended');
      }
      return this.issueTokens({
        user,
        scope: 'reseller',
        resellerId: m.resellerId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });
    }

    // Institute scope
    if (storedToken.membership) {
      const m = storedToken.membership;
      return this.issueTokens({
        user,
        scope: 'institute',
        tenantId: m.tenantId,
        membershipId: m.id,
        roleId: m.roleId,
        roleAbilities: m.role.abilities as Record<string, unknown>[],
        membershipAbilities: m.abilities as Record<string, unknown>[] | null,
        meta,
      });
    }

    // Fallback: find first active institute membership
    const firstMembership = await this.membershipRepo.findFirstActive(user.id);
    if (!firstMembership) {
      throw new UnauthorizedException('No active memberships');
    }
    return this.issueTokens({
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

  // ── Logout ─────────────────────────────────────────────

  async logout(userId: string, refreshTokenId?: string): Promise<void> {
    if (refreshTokenId) {
      await this.refreshTokenRepo.revoke(refreshTokenId);
    } else {
      await this.refreshTokenRepo.revokeAllForUser(userId);
    }
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

  async revokeAllOtherSessions(userId: string, currentTokenId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllOtherForUser(userId, currentTokenId);
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

  // ── Private: credential verification ───────────────────

  private async verifyCredentials(username: string, password: string): Promise<UserRecord> {
    const user = await this.userRepo.findByUsername(username);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  // ── Private: unified token issuance ────────────────────

  private async issueTokens(opts: {
    user: UserRecord;
    scope: AuthScope;
    tenantId?: string;
    resellerId?: string;
    membershipId: string;
    roleId: string;
    roleAbilities: Record<string, unknown>[];
    membershipAbilities: Record<string, unknown>[] | null;
    meta?: RequestMeta;
  }): Promise<AuthPayload> {
    const tokenId = uuidv4();

    const accessPayload: AccessTokenPayload = {
      sub: opts.user.id,
      scope: opts.scope,
      ...(opts.tenantId && { tenantId: opts.tenantId }),
      ...(opts.resellerId && { resellerId: opts.resellerId }),
      membershipId: opts.membershipId,
      roleId: opts.roleId,
      type: 'access',
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
        roleId: opts.roleId,
        abilityRules: this.mergeAbilities(opts.roleAbilities, opts.membershipAbilities),
      },
    };
  }

  private mergeAbilities(
    roleAbilities: Record<string, unknown>[] | unknown,
    membershipAbilities: Record<string, unknown>[] | null | unknown,
  ): Record<string, unknown>[] {
    const role = Array.isArray(roleAbilities) ? roleAbilities : [];
    const member = Array.isArray(membershipAbilities) ? membershipAbilities : [];
    return [...role, ...member];
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
