import { createHash } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { v4 as uuidv4 } from 'uuid';
import type { AuthPayload, LoginResult } from './dto/auth-payload';
import type { RegisterInput } from './dto/register.input';

interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  roleId: string;
  type: 'access';
}

interface PlatformTokenPayload {
  sub: string;
  type: 'platform';
}

interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(ADMIN_PRISMA_CLIENT) private readonly adminPrisma: AdminPrismaClient,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const passwordHash = await hash(input.password);

    const user = await this.adminPrisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.adminPrisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.adminPrisma.membership.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        role: { select: { id: true, name: true, abilities: true } },
      },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('No active memberships');
    }

    if (memberships.length === 1) {
      const m = memberships[0] as (typeof memberships)[0];
      const tokens = await this.generateTokens(user.id, m.tenantId, m.roleId, m.id);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tenantId: m.tenantId,
          roleId: m.roleId,
          abilityRules: this.mergeAbilities(
            m.role.abilities as Record<string, unknown>[],
            m.abilities as Record<string, unknown>[] | null,
          ),
        },
      };
    }

    const platformToken = this.generatePlatformToken(user.id);
    return {
      platformToken,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        roleId: m.roleId,
        orgName: m.organization.name,
        orgSlug: m.organization.slug,
        orgLogoUrl: m.organization.logoUrl ?? undefined,
        roleName: m.role.name,
      })),
    };
  }

  async loginByUserId(userId: string): Promise<LoginResult> {
    const user = await this.adminPrisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.adminPrisma.membership.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        role: { select: { id: true, name: true, abilities: true } },
      },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('No active memberships');
    }

    if (memberships.length === 1) {
      const m = memberships[0] as (typeof memberships)[0];
      const tokens = await this.generateTokens(user.id, m.tenantId, m.roleId, m.id);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tenantId: m.tenantId,
          roleId: m.roleId,
          abilityRules: this.mergeAbilities(
            m.role.abilities as Record<string, unknown>[],
            m.abilities as Record<string, unknown>[] | null,
          ),
        },
      };
    }

    const platformToken = this.generatePlatformToken(user.id);
    return {
      platformToken,
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        roleId: m.roleId,
        orgName: m.organization.name,
        orgSlug: m.organization.slug,
        orgLogoUrl: m.organization.logoUrl ?? undefined,
        roleName: m.role.name,
      })),
    };
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.adminPrisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return false;
    return verify(user.passwordHash, password);
  }

  async selectOrganization(userId: string, tenantId: string): Promise<AuthPayload> {
    const membership = await this.adminPrisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        role: { select: { id: true, name: true, abilities: true } },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('No active membership for this organization');
    }

    const user = await this.adminPrisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(userId, tenantId, membership.roleId, membership.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tenantId: membership.tenantId,
        roleId: membership.roleId,
        abilityRules: this.mergeAbilities(
          membership.role.abilities as Record<string, unknown>[],
          membership.abilities as Record<string, unknown>[] | null,
        ),
      },
    };
  }

  async refreshToken(token: string): Promise<AuthPayload> {
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
    const storedToken = await this.adminPrisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: {
        user: true,
        membership: {
          include: {
            role: { select: { id: true, abilities: true } },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (storedToken.tokenHash !== tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      await this.adminPrisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.adminPrisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = storedToken.user;
    const membership = storedToken.membership;

    if (membership) {
      const tokens = await this.generateTokens(
        user.id,
        membership.tenantId,
        membership.roleId,
        membership.id,
      );
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          tenantId: membership.tenantId,
          roleId: membership.roleId,
          abilityRules: this.mergeAbilities(
            membership.role.abilities as Record<string, unknown>[],
            membership.abilities as Record<string, unknown>[] | null,
          ),
        },
      };
    }

    // Legacy refresh token without membership — issue tokens for first active membership
    const firstMembership = await this.adminPrisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      include: { role: { select: { id: true, abilities: true } } },
    });

    if (!firstMembership) {
      throw new UnauthorizedException('No active memberships');
    }

    const tokens = await this.generateTokens(
      user.id,
      firstMembership.tenantId,
      firstMembership.roleId,
      firstMembership.id,
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tenantId: firstMembership.tenantId,
        roleId: firstMembership.roleId,
        abilityRules: this.mergeAbilities(
          firstMembership.role.abilities as Record<string, unknown>[],
          firstMembership.abilities as Record<string, unknown>[] | null,
        ),
      },
    };
  }

  async logout(userId: string, refreshTokenId?: string): Promise<void> {
    if (refreshTokenId) {
      await this.adminPrisma.refreshToken.update({
        where: { id: refreshTokenId },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.adminPrisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private generatePlatformToken(userId: string): string {
    const payload: PlatformTokenPayload = { sub: userId, type: 'platform' };
    return this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '5m',
    });
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    roleId: string,
    membershipId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenId = uuidv4();

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      tenantId,
      roleId,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      tokenId,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.adminPrisma.refreshToken.create({
      data: {
        id: tokenId,
        tokenHash,
        userId,
        tenantId,
        membershipId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
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
