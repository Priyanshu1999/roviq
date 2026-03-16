import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';
import type { MembershipRepository } from '../repositories/membership.repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { UserRepository } from '../repositories/user.repository';

function createMockUserRepo() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
  };
}

function createMockMembershipRepo() {
  return {
    findActiveByUserId: vi.fn(),
    findByUserAndTenant: vi.fn(),
    findFirstActive: vi.fn(),
  };
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn(),
    findByIdWithRelations: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
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
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;
  let mockMembershipRepo: ReturnType<typeof createMockMembershipRepo>;
  let mockRefreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>;
  let mockJwt: ReturnType<typeof createMockJwtService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepo();
    mockMembershipRepo = createMockMembershipRepo();
    mockRefreshTokenRepo = createMockRefreshTokenRepo();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();

    authService = new AuthService(
      mockConfig as unknown as ConfigService,
      mockJwt as unknown as JwtService,
      mockUserRepo as unknown as UserRepository,
      mockMembershipRepo as unknown as MembershipRepository,
      mockRefreshTokenRepo as unknown as RefreshTokenRepository,
    );
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      status: 'ACTIVE',
      institute: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
      role: { id: 'role-1', name: 'Admin', abilities: [] },
    };

    beforeEach(async () => {
      mockUser.passwordHash = await hash('correct-password');
    });

    it('should return tenant-scoped JWT when user has single membership', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
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
        institute: { id: 'tenant-2', name: 'Other Org', slug: 'other-org', logoUrl: null },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('platform-jwt');

      const result = await authService.login('admin', 'correct-password');

      expect(result.platformToken).toBe('platform-jwt');
      expect(result.memberships).toHaveLength(2);
      expect(result.memberships?.[0]?.instituteName).toBe('Test Org');
      expect(result.memberships?.[1]?.instituteName).toBe('Other Org');
      expect(result.accessToken).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.login('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      await expect(authService.login('admin', 'correct-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);

      await expect(authService.login('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user has no active memberships', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([]);

      await expect(authService.login('admin', 'correct-password')).rejects.toThrow(
        'No active memberships',
      );
    });

    it('should use the same error message for user-not-found and wrong-password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);
      const err1 = await authService.login('admin', 'pass').catch((e: Error) => e);

      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      const err2 = await authService.login('admin', 'wrong').catch((e: Error) => e);

      expect((err1 as UnauthorizedException).message).toBe((err2 as UnauthorizedException).message);
    });

    it('should find user by username (no tenantId)', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);

      await authService.login('admin', 'pass').catch(() => {});

      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('admin');
    });

    it('should store hashed refresh token in DB with membershipId', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);

      await authService.login('admin', 'correct-password');

      expect(mockRefreshTokenRepo.create).toHaveBeenCalledTimes(1);
      const createCall = mockRefreshTokenRepo.create.mock.calls[0][0];
      expect(createCall.tokenHash).toBeDefined();
      expect(createCall.tokenHash.length).toBe(64);
      expect(createCall.userId).toBe('user-1');
      expect(createCall.tenantId).toBe('tenant-1');
      expect(createCall.membershipId).toBe('membership-1');
    });
  });

  describe('loginByUserId', () => {
    const mockUser = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      status: 'ACTIVE',
      institute: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
      role: { id: 'role-1', name: 'Admin', abilities: [] },
    };

    it('should return tenant-scoped JWT for single membership without password', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.loginByUserId('user-1');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.platformToken).toBeUndefined();
    });

    it('should return platform token for multi-institute user', async () => {
      const secondMembership = {
        ...mockMembership,
        id: 'membership-2',
        tenantId: 'tenant-2',
        institute: { id: 'tenant-2', name: 'Other Org', slug: 'other-org', logoUrl: null },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('platform-jwt');

      const result = await authService.loginByUserId('user-1');

      expect(result.platformToken).toBe('platform-jwt');
      expect(result.memberships).toHaveLength(2);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(authService.loginByUserId('nonexistent')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user has no active memberships', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([]);

      await expect(authService.loginByUserId('user-1')).rejects.toThrow('No active memberships');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const passwordHash = await hash('correct-password');
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash,
      });

      const result = await authService.verifyPassword('user-1', 'correct-password');
      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const passwordHash = await hash('correct-password');
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash,
      });

      const result = await authService.verifyPassword('user-1', 'wrong-password');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await authService.verifyPassword('missing', 'password');
      expect(result).toBe(false);
    });
  });

  describe('selectInstitute', () => {
    it('should issue tenant-scoped JWT for valid membership', async () => {
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: null,
        status: 'ACTIVE',
        institute: { id: 'tenant-1', name: 'Test Org', slug: 'test-org', logoUrl: null },
        role: { id: 'role-1', name: 'Admin', abilities: [] },
      };
      const user = { id: 'user-1', username: 'admin', email: 'admin@test.com', status: 'ACTIVE' };

      mockMembershipRepo.findByUserAndTenant.mockResolvedValue(membership);
      mockUserRepo.findById.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('access-jwt');

      const result = await authService.selectInstitute('user-1', 'tenant-1');

      expect(result.accessToken).toBe('access-jwt');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.user?.roleId).toBe('role-1');
    });

    it('should reject if no active membership for that tenant', async () => {
      mockMembershipRepo.findByUserAndTenant.mockResolvedValue(null);

      await expect(authService.selectInstitute('user-1', 'tenant-999')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject inactive membership', async () => {
      mockMembershipRepo.findByUserAndTenant.mockResolvedValue({
        id: 'membership-1',
        status: 'SUSPENDED',
        institute: {},
        role: {},
      });

      await expect(authService.selectInstitute('user-1', 'tenant-1')).rejects.toThrow(
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
      mockUserRepo.create.mockResolvedValue(createdUser);

      const result = await authService.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'SecurePass123!',
      });

      expect(result.user?.username).toBe('newuser');

      const createCall = mockUserRepo.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe('SecurePass123!');
      expect(createCall.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('should propagate unique constraint error on duplicate username', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`username`)');
      prismaError.name = 'PrismaClientKnownRequestError';
      mockUserRepo.create.mockRejectedValue(prismaError);

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
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
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

      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('new-jwt');

      const result = await authService.refreshToken(fakeToken);

      expect(result.accessToken).toBe('new-jwt');
      expect(result.user?.id).toBe('user-1');
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(tokenId);
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
      const tokenHash = createHash('sha256').update('mock-token').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
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

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('should throw when token not found in DB', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId: 'missing', type: 'refresh' });
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue(null);

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token not found',
      );
    });

    it('should throw when token hash does not match', async () => {
      const tokenId = 'token-mismatch';
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tokenId, type: 'refresh' });
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
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
      const tokenHash = createHash('sha256').update('mock-token').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
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

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
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
      mockMembershipRepo.findFirstActive.mockResolvedValue({
        id: 'membership-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: memberAbilities,
        role: { id: 'role-1', abilities: roleAbilities },
      });

      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('new-jwt');

      const result = await authService.refreshToken(fakeToken);

      expect(result.user?.abilityRules).toEqual([...roleAbilities, ...memberAbilities]);
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token when ID provided', async () => {
      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);

      await authService.logout('user-1', 'token-id-1');

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith('token-id-1');
    });

    it('should revoke all user tokens when no token ID provided', async () => {
      mockRefreshTokenRepo.revokeAllForUser.mockResolvedValue(undefined);

      await authService.logout('user-1');

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('should not throw when called twice with same token ID', async () => {
      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);

      await authService.logout('user-1', 'token-id-1');
      await authService.logout('user-1', 'token-id-1');

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = { id: 'user-1', username: 'admin', email: 'admin@test.com', status: 'ACTIVE' };
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await authService.getUserById('user-1');
      expect(result).toEqual(user);
    });

    it('should return null when not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await authService.getUserById('missing');
      expect(result).toBeNull();
    });
  });

  describe('getUserIdByUsername', () => {
    it('should return user id when found', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({ id: 'user-1', username: 'admin' });

      const result = await authService.getUserIdByUsername('admin');
      expect(result).toBe('user-1');
    });

    it('should return null when not found', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);

      const result = await authService.getUserIdByUsername('nonexistent');
      expect(result).toBeNull();
    });
  });
});
