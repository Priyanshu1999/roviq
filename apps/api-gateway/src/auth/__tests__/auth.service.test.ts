import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';
import type { MembershipRepository } from '../repositories/membership.repository';
import type { PlatformMembershipRepository } from '../repositories/platform-membership.repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { ResellerMembershipRepository } from '../repositories/reseller-membership.repository';
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

function createMockPlatformMembershipRepo() {
  return {
    findByUserId: vi.fn(),
  };
}

function createMockResellerMembershipRepo() {
  return {
    findByUserId: vi.fn(),
    findByUserAndReseller: vi.fn(),
  };
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn(),
    findByIdWithRelations: vi.fn(),
    findActiveByUserId: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    revokeAllOtherForUser: vi.fn(),
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
  let mockPlatformMembershipRepo: ReturnType<typeof createMockPlatformMembershipRepo>;
  let mockResellerMembershipRepo: ReturnType<typeof createMockResellerMembershipRepo>;
  let mockRefreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>;
  let mockJwt: ReturnType<typeof createMockJwtService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepo();
    mockMembershipRepo = createMockMembershipRepo();
    mockPlatformMembershipRepo = createMockPlatformMembershipRepo();
    mockResellerMembershipRepo = createMockResellerMembershipRepo();
    mockRefreshTokenRepo = createMockRefreshTokenRepo();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();

    authService = new AuthService(
      mockConfig as unknown as ConfigService,
      mockJwt as unknown as JwtService,
      mockUserRepo as unknown as UserRepository,
      mockMembershipRepo as unknown as MembershipRepository,
      mockPlatformMembershipRepo as unknown as PlatformMembershipRepository,
      mockResellerMembershipRepo as unknown as ResellerMembershipRepository,
      mockRefreshTokenRepo as unknown as RefreshTokenRepository,
    );
  });

  describe('instituteLogin', () => {
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
      institute: { id: 'tenant-1', name: 'Test Institute', slug: 'test-institute', logoUrl: null },
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

      const result = await authService.instituteLogin('admin', 'correct-password');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
      expect(result.user?.id).toBe('user-1');
      expect(result.user?.username).toBe('admin');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.requiresInstituteSelection).toBeUndefined();
    });

    it('should return membership list when user has multiple memberships', async () => {
      const secondMembership = {
        ...mockMembership,
        id: 'membership-2',
        tenantId: 'tenant-2',
        institute: {
          id: 'tenant-2',
          name: 'Other Institute',
          slug: 'other-institute',
          logoUrl: null,
        },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);

      const result = await authService.instituteLogin('admin', 'correct-password');

      expect(result.requiresInstituteSelection).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.memberships).toHaveLength(2);
      expect(result.memberships?.[0]?.instituteName).toBe('Test Institute');
      expect(result.memberships?.[1]?.instituteName).toBe('Other Institute');
      expect(result.accessToken).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.instituteLogin('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

      await expect(authService.instituteLogin('admin', 'correct-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);

      await expect(authService.instituteLogin('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user has no active memberships', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([]);

      await expect(authService.instituteLogin('admin', 'correct-password')).rejects.toThrow(
        'No account found',
      );
    });

    it('should use the same error message for user-not-found and wrong-password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);
      const err1 = await authService.instituteLogin('admin', 'pass').catch((e: Error) => e);

      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      const err2 = await authService.instituteLogin('admin', 'wrong').catch((e: Error) => e);

      expect((err1 as UnauthorizedException).message).toBe((err2 as UnauthorizedException).message);
    });

    it('should find user by username', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(null);

      await authService.instituteLogin('admin', 'pass').catch(() => {});

      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('admin');
    });

    it('should store refresh token in DB with membershipId and membershipScope', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);

      await authService.instituteLogin('admin', 'correct-password');

      expect(mockRefreshTokenRepo.create).toHaveBeenCalledTimes(1);
      const createCall = mockRefreshTokenRepo.create.mock.calls[0][0];
      expect(createCall.tokenHash).toBeDefined();
      expect(createCall.tokenHash.length).toBe(64);
      expect(createCall.userId).toBe('user-1');
      expect(createCall.tenantId).toBe('tenant-1');
      expect(createCall.membershipId).toBe('membership-1');
      expect(createCall.membershipScope).toBe('institute');
    });
  });

  describe('adminLogin', () => {
    const mockUser = {
      id: 'user-1',
      username: 'platformadmin',
      email: 'admin@platform.com',
      passwordHash: '',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPlatformMembership = {
      id: 'pm-1',
      userId: 'user-1',
      roleId: 'platform-role-1',
      abilities: null,
      role: { id: 'platform-role-1', name: 'PlatformAdmin', abilities: [] },
    };

    beforeEach(async () => {
      mockUser.passwordHash = await hash('correct-password');
    });

    it('should return platform-scoped JWT for valid platform admin', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockPlatformMembershipRepo.findByUserId.mockResolvedValue(mockPlatformMembership);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('platform-jwt');

      const result = await authService.adminLogin('platformadmin', 'correct-password');

      expect(result.accessToken).toBe('platform-jwt');
      expect(result.refreshToken).toBe('platform-jwt');
      expect(result.user?.id).toBe('user-1');
      expect(result.user?.scope).toBe('platform');
    });

    it('should throw when user has no platform membership', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockPlatformMembershipRepo.findByUserId.mockResolvedValue(null);

      await expect(authService.adminLogin('platformadmin', 'correct-password')).rejects.toThrow(
        'No account found',
      );
    });

    it('should reject invalid password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.adminLogin('platformadmin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('instituteLoginByUserId', () => {
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
      institute: { id: 'tenant-1', name: 'Test Institute', slug: 'test-institute', logoUrl: null },
      role: { id: 'role-1', name: 'Admin', abilities: [] },
    };

    it('should return tenant-scoped JWT for single membership without password', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.instituteLoginByUserId('user-1');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.requiresInstituteSelection).toBeUndefined();
    });

    it('should return membership list for multi-institute user', async () => {
      const secondMembership = {
        ...mockMembership,
        id: 'membership-2',
        tenantId: 'tenant-2',
        institute: {
          id: 'tenant-2',
          name: 'Other Institute',
          slug: 'other-institute',
          logoUrl: null,
        },
        role: { id: 'role-2', name: 'Teacher', abilities: [] },
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);

      const result = await authService.instituteLoginByUserId('user-1');

      expect(result.requiresInstituteSelection).toBe(true);
      expect(result.memberships).toHaveLength(2);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(authService.instituteLoginByUserId('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when user has no active memberships', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([]);

      await expect(authService.instituteLoginByUserId('user-1')).rejects.toThrow(
        'No account found',
      );
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
        institute: {
          id: 'tenant-1',
          name: 'Test Institute',
          slug: 'test-institute',
          logoUrl: null,
        },
        role: { id: 'role-1', name: 'Admin', abilities: [] },
      };
      const user = {
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        status: 'ACTIVE',
      };

      mockMembershipRepo.findByUserAndTenant.mockResolvedValue(membership);
      mockUserRepo.findById.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('access-jwt');

      const result = await authService.selectInstitute('user-1', 'membership-1');

      expect(result.accessToken).toBe('access-jwt');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.user?.roleId).toBe('role-1');
    });

    it('should reject if no active membership found', async () => {
      mockMembershipRepo.findByUserAndTenant.mockResolvedValue(null);

      await expect(authService.selectInstitute('user-1', 'membership-999')).rejects.toThrow(
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

      await expect(authService.selectInstitute('user-1', 'membership-1')).rejects.toThrow(
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
      const dbError = new Error('Unique constraint failed on the fields: (`username`)');
      mockUserRepo.create.mockRejectedValue(dbError);

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
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const fakeToken = 'mock-token';
      const expectedHash = createHash('sha256').update(fakeToken).digest('hex');
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash: expectedHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        membershipScope: 'institute',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          passwordChangedAt: null,
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
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('mock-token').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        membershipScope: 'institute',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          passwordChangedAt: null,
        },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token reuse detected',
      );

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('should throw when token not found in DB', async () => {
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId: 'missing',
        membershipId: 'membership-1',
        type: 'refresh',
      });
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue(null);

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw when token hash does not match', async () => {
      const tokenId = 'token-mismatch';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });
      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash: 'wrong-hash-value',
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        membershipScope: 'institute',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: { id: 'user-1', passwordChangedAt: null },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw on expired refresh token', async () => {
      const tokenId = 'expired-token';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('mock-token').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        membershipScope: 'institute',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        user: { id: 'user-1', passwordChangedAt: null },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow('Refresh token expired');
    });

    it('should re-issue management tokens via fallback when no membership on stored token', async () => {
      const tokenId = 'fallback-token';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const fakeToken = 'mock-token';
      const expectedHash = createHash('sha256').update(fakeToken).digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash: expectedHash,
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        membershipScope: 'institute',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: { id: 'user-1', username: 'admin', email: 'admin@test.com', passwordChangedAt: null },
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
});
