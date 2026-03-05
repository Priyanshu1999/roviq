import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';

// Mock Prisma client
function createMockPrisma() {
  return {
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    role: {
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

    // Construct the service manually (no NestJS DI in unit tests)
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
      tenantId: 'tenant-1',
      roleId: 'role-1',
      passwordHash: '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      abilities: null,
    };

    beforeEach(async () => {
      mockUser.passwordHash = await argon2.hash('correct-password', {
        type: argon2.argon2id,
      });
    });

    it('should return tokens and user on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.login('admin', 'correct-password', 'tenant-1');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.username).toBe('admin');
      expect(result.user.tenantId).toBe('tenant-1');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.login('nonexistent', 'password', 'tenant-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(authService.login('admin', 'wrong-password', 'tenant-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should use the same error message for user-not-found and wrong-password', async () => {
      // User not found
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const err1 = await authService.login('admin', 'pass', 'tenant-1').catch((e: Error) => e);

      // Wrong password
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      const err2 = await authService.login('admin', 'wrong', 'tenant-1').catch((e: Error) => e);

      expect((err1 as UnauthorizedException).message).toBe((err2 as UnauthorizedException).message);
    });

    it('should filter by both username and tenantId', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await authService.login('admin', 'pass', 'tenant-1').catch(() => {});

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'admin', tenantId: 'tenant-1' },
      });
    });

    it('should store hashed refresh token in DB', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await authService.login('admin', 'correct-password', 'tenant-1');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.tokenHash.length).toBe(64); // SHA-256 hex
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.tenantId).toBe('tenant-1');
    });
  });

  describe('register', () => {
    it('should hash password with argon2id and create user', async () => {
      const createdUser = {
        id: 'new-user',
        username: 'newuser',
        email: 'new@test.com',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        passwordHash: '$argon2id$...',
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(result.user.username).toBe('newuser');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify password was hashed (not stored as plaintext)
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('SecurePass123!');
      expect(createCall.data.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('should propagate Prisma unique constraint error on duplicate username', async () => {
      const prismaError = new Error(
        'Unique constraint failed on the fields: (`tenant_id`,`username`)',
      );
      prismaError.name = 'PrismaClientKnownRequestError';
      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(
        authService.register({
          username: 'existing',
          email: 'new@test.com',
          password: 'SecurePass123!',
          tenantId: 'tenant-1',
          roleId: 'role-1',
        }),
      ).rejects.toThrow('Unique constraint failed');
    });

    it('should look up default role when roleId not provided', async () => {
      const defaultRole = { id: 'default-role-id', name: 'student', isDefault: true };
      mockPrisma.role.findFirst.mockResolvedValue(defaultRole);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        username: 'newuser',
        email: 'new@test.com',
        tenantId: 'tenant-1',
        roleId: 'default-role-id',
        passwordHash: '$argon2id$...',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await authService.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-1',
      });

      expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isDefault: true },
      });
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.roleId).toBe('default-role-id');
    });

    it('should throw when no default role exists and roleId not provided', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);

      await expect(
        authService.register({
          username: 'newuser',
          email: 'new@test.com',
          password: 'SecurePass123!',
          tenantId: 'tenant-1',
        }),
      ).rejects.toThrow('No default role configured');
    });
  });

  describe('refreshToken', () => {
    it('should issue new tokens on valid refresh', async () => {
      const tokenId = 'token-id-1';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: '', // Will be overridden below
        userId: 'user-1',
        tenantId: 'tenant-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          tenantId: 'tenant-1',
          roleId: 'role-1',
        },
      });

      // Match the token hash
      const { createHash } = await import('node:crypto');
      const fakeToken = 'mock-token';
      const expectedHash = createHash('sha256').update(fakeToken).digest('hex');
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: tokenId,
        tokenHash: expectedHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          tenantId: 'tenant-1',
          roleId: 'role-1',
        },
      });

      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockJwt.sign.mockReturnValue('new-jwt');

      const result = await authService.refreshToken(fakeToken);

      expect(result.accessToken).toBe('new-jwt');
      expect(result.user.id).toBe('user-1');
      // Old token should be revoked
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
        revokedAt: new Date(), // Already revoked — reuse!
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          tenantId: 'tenant-1',
          roleId: 'r1',
        },
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token reuse detected',
      );

      // All tokens for the user should be revoked
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
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: { id: 'user-1' },
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
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        user: { id: 'user-1' },
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Refresh token expired');
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
