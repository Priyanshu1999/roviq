import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';

function createMockPrisma() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-token'),
    verify: vi.fn(),
  };
}

function createMockConfigService() {
  const envs: Record<string, string> = {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  };
  return {
    get: vi.fn((key: string) => envs[key]),
    getOrThrow: vi.fn((key: string) => {
      const val = envs[key];
      if (!val) throw new Error(`${key} not set`);
      return val;
    }),
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockJwt: ReturnType<typeof createMockJwtService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();

    authService = new AuthService(
      mockConfig as unknown as ConfigService,
      mockJwt as unknown as JwtService,
      mockPrisma as any,
    );
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      isActive: true,
      organization: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
      role: { id: 'role-1', name: 'Admin', abilities: [] },
    };

    beforeEach(async () => {
      mockUser.passwordHash = await hash('correct-password');
    });

    it('should return tenant-scoped JWT when user has single membership', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership]);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.login('admin', 'correct-password');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
      expect(result.user?.id).toBe('user-1');
      expect(result.user?.username).toBe('admin');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.platformToken).toBeUndefined();
    });

    it('should return platform token + membership list when user has multiple memberships', async () => {
      const secondMembership = {
        ...mockMembership,
        id: 'membership-2',
        tenantId: 'tenant-2',
        organization: { id: 'tenant-2', name: 'Other Org', slug: 'other-org', logoUrl: null },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('platform-jwt');

      const result = await authService.login('admin', 'correct-password');

      expect(result.platformToken).toBe('platform-jwt');
      expect(result.memberships).toHaveLength(2);
      expect(result.memberships?.[0]?.orgName).toBe('Test Org');
      expect(result.memberships?.[1]?.orgName).toBe('Other Org');
      expect(result.accessToken).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.login('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(authService.login('admin', 'correct-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user has no active memberships', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([]);

      await expect(authService.login('admin', 'correct-password')).rejects.toThrow(
        'No active memberships',
      );
    });

    it('should use the same error message for user-not-found and wrong-password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const err1 = await authService.login('admin', 'pass').catch((e: Error) => e);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const err2 = await authService.login('admin', 'wrong').catch((e: Error) => e);

      expect((err1 as UnauthorizedException).message).toBe((err2 as UnauthorizedException).message);
    });

    it('should find user by username (no tenantId)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authService.login('admin', 'pass').catch(() => {});

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'admin' },
      });
    });

    it('should store hashed refresh token in DB with membershipId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership]);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await authService.login('admin', 'correct-password');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.tokenHash.length).toBe(64);
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.tenantId).toBe('tenant-1');
      expect(createCall.data.membershipId).toBe('membership-1');
    });
  });

  describe('loginByUserId', () => {
    const mockUser = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      isActive: true,
      organization: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
      role: { id: 'role-1', name: 'Admin', abilities: [] },
    };

    it('should return tenant-scoped JWT for single membership without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership]);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.loginByUserId('user-1');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.platformToken).toBeUndefined();
    });

    it('should return platform token for multi-org user', async () => {
      const secondMembership = {
        ...mockMembership,
        id: 'membership-2',
        tenantId: 'tenant-2',
        organization: { id: 'tenant-2', name: 'Other Org', slug: 'other-org', logoUrl: null },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('platform-jwt');

      const result = await authService.loginByUserId('user-1');

      expect(result.platformToken).toBe('platform-jwt');
      expect(result.memberships).toHaveLength(2);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.loginByUserId('nonexistent')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user has no active memberships', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.membership.findMany.mockResolvedValue([]);

      await expect(authService.loginByUserId('user-1')).rejects.toThrow('No active memberships');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const passwordHash = await hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash,
      });

      const result = await authService.verifyPassword('user-1', 'correct-password');
      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const passwordHash = await hash('correct-password');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash,
      });

      const result = await authService.verifyPassword('user-1', 'wrong-password');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.verifyPassword('missing', 'password');
      expect(result).toBe(false);
    });
  });

  describe('selectOrganization', () => {
    it('should issue tenant-scoped JWT for valid membership', async () => {
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: null,
        isActive: true,
        organization: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
        role: { id: 'role-1', name: 'Admin', abilities: [] },
      };
      const user = { id: 'user-1', username: 'admin', email: 'admin@test.com' };

      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('access-jwt');

      const result = await authService.selectOrganization('user-1', 'tenant-1');

      expect(result.accessToken).toBe('access-jwt');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.user?.roleId).toBe('role-1');
    });

    it('should reject if no active membership for that tenant', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      await expect(authService.selectOrganization('user-1', 'tenant-999')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject inactive membership', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'membership-1',
        isActive: false,
        organization: {},
        role: {},
      });

      await expect(authService.selectOrganization('user-1', 'tenant-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('register', () => {
    it('should hash password with argon2id and create user (platform-level)', async () => {
      const createdUser = {
        id: 'new-user',
        username: 'newuser',
        email: 'new@test.com',
        passwordHash: '$argon2id$...',
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await authService.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'SecurePass123!',
      });

      expect(result.user?.username).toBe('newuser');

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('SecurePass123!');
      expect(createCall.data.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('should propagate Prisma unique constraint error on duplicate username', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`username`)');
      prismaError.name = 'PrismaClientKnownRequestError';
      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(
        authService.register({
          username: 'existing',
          email: 'new@test.com',
          password: 'SecurePass123!',
        }),
      ).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('refreshToken', () => {
    it('should issue new tokens on valid refresh', async () => {
      const tokenId = 'token-id-1';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });

      const { createHash } = await import('node:crypto');
      const fakeToken = 'mock-token';
      const expectedHash = createHash('sha256').update(fakeToken).digest('hex');
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: expectedHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
        },
        membership: {
          id: 'membership-1',
          tenantId: 'tenant-1',
          roleId: 'role-1',
          abilities: null,
          role: { id: 'role-1', abilities: [] },
        },
      });

      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('new-jwt');

      const result = await authService.refreshToken(fakeToken);

      expect(result.accessToken).toBe('new-jwt');
      expect(result.user?.id).toBe('user-1');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tokenId },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('should throw on invalid JWT', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(authService.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when token type is not refresh', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', type: 'access' });

      await expect(authService.refreshToken('access-token')).rejects.toThrow('Invalid token type');
    });

    it('should revoke all tokens on reuse detection', async () => {
      const tokenId = 'token-reused';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });

      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update('mock-token').digest('hex');

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: hash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: null,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
        },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token reuse detected',
      );

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw when token not found in DB', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId: 'missing', type: 'refresh' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token not found',
      );
    });

    it('should throw when token hash does not match', async () => {
      const tokenId = 'token-mismatch';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: 'wrong-hash-value',
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: 'user-1' },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw on expired refresh token', async () => {
      const tokenId = 'expired-token';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });

      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update('mock-token').digest('hex');

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: hash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000),
        user: { id: 'user-1' },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Refresh token expired');
    });

    it('should include abilityRules in legacy refresh path (no membership on token)', async () => {
      const tokenId = 'legacy-token';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });

      const { createHash } = await import('node:crypto');
      const fakeToken = 'mock-token';
      const expectedHash = createHash('sha256').update(fakeToken).digest('hex');

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: expectedHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: 'user-1', username: 'admin', email: 'admin@test.com' },
        membership: null,
      });

      const roleAbilities = [{ action: 'manage', subject: 'all' }];
      const memberAbilities = [{ action: 'read', subject: 'Profile' }];
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: memberAbilities,
        role: { id: 'role-1', abilities: roleAbilities },
      });

      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('new-jwt');

      const result = await authService.refreshToken(fakeToken);

      expect(result.user?.abilityRules).toEqual([...roleAbilities, ...memberAbilities]);
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token when ID provided', async () => {
      mockPrisma.refreshToken.update.mockResolvedValue({});

      await authService.logout('user-1', 'token-id-1');

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all user tokens when no token ID provided', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await authService.logout('user-1');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not throw when called twice with same token ID', async () => {
      mockPrisma.refreshToken.update.mockResolvedValue({});

      await authService.logout('user-1', 'token-id-1');
      await authService.logout('user-1', 'token-id-1');

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledTimes(2);
    });
  });
});
