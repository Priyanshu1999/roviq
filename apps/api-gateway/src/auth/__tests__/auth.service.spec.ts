import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import { hash } from '@node-rs/argon2';
import { AbilityFactory } from '@roviq/casl';
import { NEW_PASSWORD_MIN_LENGTH } from '@roviq/common-types';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';
import { AuthEventService } from '../auth-event.service';
import { LoginLockoutService } from '../login-lockout.service';
import { MembershipRepository } from '../repositories/membership.repository';
import { PlatformMembershipRepository } from '../repositories/platform-membership.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { ResellerMembershipRepository } from '../repositories/reseller-membership.repository';
import { UserRepository } from '../repositories/user.repository';

function createMockUserRepo() {
  return createMock<UserRepository>({
    create: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
    updatePasswordHash: vi.fn(),
    updatePassword: vi.fn(),
  });
}

function createMockLockoutService() {
  return createMock<LoginLockoutService>({
    isLocked: vi.fn().mockResolvedValue(false),
    recordFailure: vi.fn().mockResolvedValue({ locked: false, remainingAttempts: 4 }),
    clearOnSuccess: vi.fn().mockResolvedValue(undefined),
  });
}

function createMockMembershipRepo() {
  return createMock<MembershipRepository>({
    findActiveByUserId: vi.fn(),
    findManyByUserAndTenant: vi.fn(),
    findByIdAndUser: vi.fn(),
    findFirstActive: vi.fn(),
  });
}

function createMockPlatformMembershipRepo() {
  return createMock<PlatformMembershipRepository>({
    findByUserId: vi.fn(),
  });
}

function createMockResellerMembershipRepo() {
  return createMock<ResellerMembershipRepository>({
    findByUserId: vi.fn(),
    findByUserAndReseller: vi.fn(),
  });
}

function createMockRefreshTokenRepo() {
  return createMock<RefreshTokenRepository>({
    create: vi.fn(),
    findByIdWithRelations: vi.fn(),
    findByHash: vi.fn(),
    findActiveByUserId: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    revokeAllOtherForUser: vi.fn(),
  });
}

function createMockJwtService() {
  return createMock<JwtService>({
    sign: vi.fn().mockReturnValue('mock-token'),
    verify: vi.fn(),
  });
}

function createMockAuthEventService() {
  return createMock<AuthEventService>({
    emit: vi.fn().mockResolvedValue(undefined),
  });
}

function createMockConfigService() {
  const envs: Record<string, string> = {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  };
  return createMock<ConfigService>({
    get: vi.fn((key: string) => envs[key]),
    getOrThrow: vi.fn((key: string) => {
      const val = envs[key];
      if (!val) throw new Error(`${key} not set`);
      return val;
    }),
  });
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
  let mockAuthEventService: ReturnType<typeof createMockAuthEventService>;
  let mockLockout: ReturnType<typeof createMockLockoutService>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepo();
    mockMembershipRepo = createMockMembershipRepo();
    mockPlatformMembershipRepo = createMockPlatformMembershipRepo();
    mockResellerMembershipRepo = createMockResellerMembershipRepo();
    mockRefreshTokenRepo = createMockRefreshTokenRepo();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();
    mockAuthEventService = createMockAuthEventService();
    mockLockout = createMockLockoutService();

    const mockAbilityFactory = createMock<AbilityFactory>({
      createForUser: vi.fn().mockResolvedValue({ rules: [] }),
    });
    const mockJetStreamClient = createMock<ClientProxy>({ emit: vi.fn() });

    authService = new AuthService(
      mockConfig,
      mockJwt,
      mockUserRepo,
      mockMembershipRepo,
      mockPlatformMembershipRepo,
      mockResellerMembershipRepo,
      mockRefreshTokenRepo,
      mockAuthEventService,
      mockAbilityFactory,
      mockLockout,
      mockJetStreamClient,
    );
  });

  describe('instituteLogin', () => {
    const mockUser = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '',
      status: 'ACTIVE' as const,
      passwordChangedAt: null,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      status: 'ACTIVE' as const,
      institute: {
        id: 'tenant-1',
        name: { en: 'Test Institute' },
        slug: 'test-institute',
        logoUrl: null,
      },
      role: { id: 'role-1', name: { en: 'Admin' }, abilities: [] },
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
          name: { en: 'Other Institute' },
          slug: 'other-institute',
          logoUrl: null,
        },
        role: { id: 'role-2', name: { en: 'Teacher' }, abilities: [] },
      };

      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('mock-selection-token');

      const result = await authService.instituteLogin('admin', 'correct-password');

      expect(result.requiresInstituteSelection).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.selectionToken).toBe('mock-selection-token');
      expect(result.memberships).toHaveLength(2);
      expect(result.memberships?.[0]?.instituteName).toEqual({ en: 'Test Institute' });
      expect(result.memberships?.[1]?.instituteName).toEqual({ en: 'Other Institute' });
      expect(result.accessToken).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.instituteLogin('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' as const });

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
      status: 'ACTIVE' as const,
      passwordChangedAt: null,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPlatformMembership = {
      id: 'pm-1',
      userId: 'user-1',
      roleId: 'platform-role-1',
      isActive: true,
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
      status: 'ACTIVE' as const,
      passwordChangedAt: null,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      abilities: null,
      status: 'ACTIVE' as const,
      institute: {
        id: 'tenant-1',
        name: { en: 'Test Institute' },
        slug: 'test-institute',
        logoUrl: null,
      },
      role: { id: 'role-1', name: { en: 'Admin' }, abilities: [] },
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
          name: { en: 'Other Institute' },
          slug: 'other-institute',
          logoUrl: null,
        },
        role: { id: 'role-2', name: { en: 'Teacher' }, abilities: [] },
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([mockMembership, secondMembership]);
      mockJwt.sign.mockReturnValue('mock-selection-token');

      const result = await authService.instituteLoginByUserId('user-1');

      expect(result.requiresInstituteSelection).toBe(true);
      expect(result.selectionToken).toBe('mock-selection-token');
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
        username: 'admin',
        email: 'admin@test.com',
        passwordHash,
        status: 'ACTIVE',
        passwordChangedAt: null,
        mustChangePassword: false,
      });

      const result = await authService.verifyPassword('user-1', 'correct-password');
      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const passwordHash = await hash('correct-password');
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash,
        status: 'ACTIVE',
        passwordChangedAt: null,
        mustChangePassword: false,
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
    beforeEach(() => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'institute-selection' });
    });

    it('should issue tenant-scoped JWT for valid membership', async () => {
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: null,
        status: 'ACTIVE' as const,
        institute: {
          id: 'tenant-1',
          name: { en: 'Test Institute' },
          slug: 'test-institute',
          logoUrl: null,
        },
        role: { id: 'role-1', name: { en: 'Admin' }, abilities: [] },
      };
      const user = {
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: 'mock-hash',
        status: 'ACTIVE' as const,
        passwordChangedAt: null,
        mustChangePassword: false,
      };

      mockMembershipRepo.findByIdAndUser.mockResolvedValue(membership);
      mockUserRepo.findById.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('access-jwt');

      const result = await authService.selectInstitute('mock-selection-token', 'membership-1');

      expect(result.accessToken).toBe('access-jwt');
      expect(result.user?.tenantId).toBe('tenant-1');
      expect(result.user?.roleId).toBe('role-1');
    });

    it('should reject if no active membership found', async () => {
      mockMembershipRepo.findByIdAndUser.mockResolvedValue(null);

      await expect(
        authService.selectInstitute('mock-selection-token', 'membership-999'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject inactive membership', async () => {
      mockMembershipRepo.findByIdAndUser.mockResolvedValue({
        id: 'membership-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        abilities: null,
        status: 'SUSPENDED',
        institute: {
          id: 'tenant-1',
          name: { en: 'Test Institute' },
          slug: 'test-institute',
          logoUrl: null,
        },
        role: { id: 'role-1', name: { en: 'Admin' }, abilities: [] },
      });

      await expect(
        authService.selectInstitute('mock-selection-token', 'membership-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid selection token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(authService.selectInstitute('bad-token', 'membership-1')).rejects.toThrow(
        'Invalid or expired selection token',
      );
    });

    it('should reject token with wrong purpose', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'other' });

      await expect(
        authService.selectInstitute('wrong-purpose-token', 'membership-1'),
      ).rejects.toThrow('Invalid or expired selection token');
    });
  });

  describe('register', () => {
    it('should hash password with argon2id and create user (platform-level)', async () => {
      const createdUser = {
        id: 'new-user',
        username: 'newuser',
        email: 'new@test.com',
        passwordHash: '$argon2id$...',
        status: 'ACTIVE' as const,
        passwordChangedAt: null,
        mustChangePassword: false,
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
        membershipScope: 'institute',
        revokedAt: null,
        revokedReason: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
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
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: 'mock-hash',
        status: 'ACTIVE',
        passwordChangedAt: null,
        mustChangePassword: false,
      });

      const result = await authService.refreshToken(fakeToken);

      expect(result.accessToken).toBe('new-jwt');
      expect(result.user?.id).toBe('user-1');
      // Every successful refresh rotates — old token gets tagged `rotation`
      // so any subsequent use triggers the reuse-cascade.
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(tokenId, 'rotation');
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
        membershipScope: 'institute',
        revokedAt: new Date(),
        // `rotation` (or null) triggers the family-kill cascade — the
        // attacker-replayed-after-rotation scenario this test guards.
        revokedReason: 'rotation',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      await expect(authService.refreshToken('mock-token')).rejects.toThrow(
        'Refresh token reuse detected',
      );

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1', 'rotation');
    });

    it('does NOT cascade-revoke when the token was revoked via user-initiated action', async () => {
      // Regression guard for #20 (revokeAllOtherSessions). Previously, any
      // revoked refresh token tripped the reuse-cascade and killed the
      // caller's own keep-alive session on the next refresh attempt.
      const tokenId = 'token-user-revoked';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('stale-but-legit').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        membershipScope: 'institute',
        revokedAt: new Date(),
        revokedReason: 'user_initiated',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      await expect(authService.refreshToken('stale-but-legit')).rejects.toThrow(
        'Refresh token revoked',
      );
      // Critical assertion: NO family kill.
      expect(mockRefreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('does NOT cascade-revoke when revoked via password_change', async () => {
      // Password-change revocation is a deliberate, user-scoped action. The
      // old token showing up afterwards is a stale client, not an attacker —
      // must not fire the family-kill cascade.
      const tokenId = 'token-password-change';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('stale-but-legit').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        membershipScope: 'institute',
        revokedAt: new Date(),
        revokedReason: 'password_change',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      await expect(authService.refreshToken('stale-but-legit')).rejects.toThrow(/revoked/i);
      expect(mockRefreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('does NOT cascade-revoke when revoked via admin_revoked', async () => {
      // Admin-initiated revocation is a deliberate, operator-scoped action.
      // Same reasoning as password_change — no family kill on re-presentation.
      const tokenId = 'token-admin-revoked';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('stale-but-legit').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        membershipScope: 'institute',
        revokedAt: new Date(),
        revokedReason: 'admin_revoked',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      await expect(authService.refreshToken('stale-but-legit')).rejects.toThrow(/revoked/i);
      expect(mockRefreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('DOES cascade-revoke on legacy row with null revokedReason', async () => {
      // Rows written before the `revokedReason` column existed have NULL
      // reasons. Without a positive "this was deliberate" signal, the safest
      // default is to treat a replayed revoked token as rotation reuse — the
      // cascade fires and the whole family dies.
      const tokenId = 'token-legacy-null';
      mockJwt.verify.mockReturnValue({
        sub: 'user-1',
        tokenId,
        membershipId: 'membership-1',
        type: 'refresh',
      });

      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update('stale-but-legit').digest('hex');

      mockRefreshTokenRepo.findByIdWithRelations.mockResolvedValue({
        id: tokenId,
        tokenHash,
        userId: 'user-1',
        membershipScope: 'institute',
        revokedAt: new Date(),
        revokedReason: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'a@b.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      await expect(authService.refreshToken('stale-but-legit')).rejects.toThrow(/reuse detected/i);
      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1', 'rotation');
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
        membershipScope: 'institute',
        revokedAt: null,
        revokedReason: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
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
        membershipScope: 'institute',
        revokedAt: null,
        revokedReason: null,
        expiresAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
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
        membershipScope: 'institute',
        revokedAt: null,
        revokedReason: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        deviceInfo: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: null,
        user: {
          id: 'user-1',
          username: 'admin',
          email: 'admin@test.com',
          status: 'ACTIVE',
          passwordChangedAt: null,
          mustChangePassword: false,
        },
        membership: null,
      });

      const roleAbilities = [{ action: 'manage', subject: 'all' }];
      const memberAbilities = [{ action: 'read', subject: 'Profile' }];
      mockMembershipRepo.findFirstActive.mockResolvedValue({
        id: 'membership-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        status: 'ACTIVE',
        abilities: memberAbilities,
        role: { id: 'role-1', abilities: roleAbilities },
      });

      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);
      mockJwt.sign.mockReturnValue('new-jwt');
      mockUserRepo.findById.mockResolvedValue({
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: 'mock-hash',
        status: 'ACTIVE',
        passwordChangedAt: null,
        mustChangePassword: false,
      });

      const result = await authService.refreshToken(fakeToken);

      expect(result.user?.abilityRules).toEqual([...roleAbilities, ...memberAbilities]);
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token when ID provided', async () => {
      mockRefreshTokenRepo.revoke.mockResolvedValue(undefined);

      await authService.logout('user-1', 'token-id-1');

      // Logout is a user action, not a rotation — reason must NOT be
      // `'rotation'` or a later refresh with the old token would trigger
      // the reuse-cascade and kill every other session.
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith('token-id-1', 'user_initiated');
    });

    it('should revoke all user tokens when no token ID provided', async () => {
      mockRefreshTokenRepo.revokeAllForUser.mockResolvedValue(undefined);

      await authService.logout('user-1');

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
        'user_initiated',
      );
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
      const user = {
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: 'mock-hash',
        status: 'ACTIVE' as const,
        passwordChangedAt: null,
        mustChangePassword: false,
      };
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

  describe('changePassword', () => {
    // ROV-96 — new contract:
    //   changePassword(userId, currentPassword, newPassword, meta?) → Promise<void>
    //   Min length is 12. Server revokes ALL refresh tokens; caller must re-login.
    const CURRENT = 'current-password-123';
    const NEW = 'NewPassword12!';
    const userId = 'user-1';

    let storedUser: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>;

    beforeEach(async () => {
      storedUser = {
        id: userId,
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: await hash(CURRENT),
        status: 'ACTIVE' as const,
        passwordChangedAt: null,
        mustChangePassword: false,
      };
      mockUserRepo.findById.mockResolvedValue(storedUser);
      mockUserRepo.updatePassword.mockResolvedValue(undefined);
      mockRefreshTokenRepo.revokeAllForUser.mockResolvedValue(undefined);
    });

    it('hashes new password, persists via updatePassword, and revokes all refresh tokens', async () => {
      const result = await authService.changePassword(userId, CURRENT, NEW);

      // New contract returns void/undefined — no token blob.
      expect(result).toBeUndefined();

      expect(mockUserRepo.updatePassword).toHaveBeenCalledTimes(1);
      const [updatedId, updatedHash] = mockUserRepo.updatePassword.mock.calls[0];
      expect(updatedId).toBe(userId);
      expect(typeof updatedHash).toBe('string');
      expect(updatedHash).not.toBe(storedUser.passwordHash);
      expect(updatedHash.startsWith('$argon2id$')).toBe(true);

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(userId, 'password_change');
    });

    it('revokes refresh tokens AFTER persisting the new password hash', async () => {
      await authService.changePassword(userId, CURRENT, NEW);

      const updateOrder = mockUserRepo.updatePassword.mock.invocationCallOrder[0];
      const revokeOrder = mockRefreshTokenRepo.revokeAllForUser.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(revokeOrder);
    });

    it('emits both password_change and all_sessions_revoked auth events', async () => {
      await authService.changePassword(userId, CURRENT, NEW, {
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(mockAuthEventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'password_change',
          ip: '127.0.0.1',
          userAgent: 'jest',
        }),
      );
      expect(mockAuthEventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'all_sessions_revoked',
          metadata: expect.objectContaining({ reason: 'password_change' }),
        }),
      );
    });

    it('rejects wrong current password with UnauthorizedException carrying expected message', async () => {
      const err = await authService
        .changePassword(userId, 'not-the-current-password', NEW)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toContain('Current password is incorrect');

      expect(mockUserRepo.updatePassword).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('rejects new password shorter than NEW_PASSWORD_MIN_LENGTH with BadRequestException', async () => {
      // One character shy of the floor, padded from 'a' so the content is
      // deterministic regardless of what NEW_PASSWORD_MIN_LENGTH is.
      const tooShort = 'a'.repeat(NEW_PASSWORD_MIN_LENGTH - 1);
      await expect(authService.changePassword(userId, CURRENT, tooShort)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepo.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects when new password equals current with BadRequestException', async () => {
      await expect(authService.changePassword(userId, CURRENT, CURRENT)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepo.updatePassword).not.toHaveBeenCalled();
    });

    // The remaining drift items (scope-specific behaviour, must_change_password
    // clearing, JWT mustChangePassword claim) are covered by integration / e2e
    // tests and don't belong on the unit boundary anymore. Marking explicitly
    // for review during the next AuthService spec sweep.
    it.todo('asserts JWT claim mustChangePassword=false on subsequent login after change');
    it.todo('verifies must_change_password column is cleared on success (integration scope)');
  });

  describe('verifyCredentials (lockout integration)', () => {
    // verifyCredentials is private, so we exercise it through instituteLogin —
    // the public surface that funnels through the same lockout path.
    const correctPassword = 'correct-password-12';
    let mockUser: NonNullable<Awaited<ReturnType<UserRepository['findByUsername']>>>;

    beforeEach(async () => {
      mockUser = {
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        passwordHash: await hash(correctPassword),
        status: 'ACTIVE' as const,
        passwordChangedAt: null,
        mustChangePassword: false,
      };
    });

    it('throws ACCOUNT_LOCKED UnauthorizedException when lockout is active', async () => {
      mockLockout.isLocked.mockResolvedValue(true);

      const err = await authService
        .instituteLogin('admin', correctPassword)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      // UnauthorizedException with object payload exposes the code via getResponse()
      const response = (err as UnauthorizedException).getResponse() as { code?: string };
      expect(response.code).toBe('ACCOUNT_LOCKED');
      expect(mockUserRepo.findByUsername).not.toHaveBeenCalled();
    });

    it('calls clearOnSuccess after a successful login', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockMembershipRepo.findActiveByUserId.mockResolvedValue([
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          roleId: 'role-1',
          abilities: null,
          status: 'ACTIVE' as const,
          institute: {
            id: 'tenant-1',
            name: { en: 'Test' },
            slug: 'test',
            logoUrl: null,
          },
          role: { id: 'role-1', name: { en: 'Admin' }, abilities: [] },
        },
      ]);
      mockRefreshTokenRepo.create.mockResolvedValue(undefined);

      await authService.instituteLogin('admin', correctPassword);

      expect(mockLockout.clearOnSuccess).toHaveBeenCalledWith('admin');
      expect(mockLockout.recordFailure).not.toHaveBeenCalled();
    });

    it('calls recordFailure on a failed login and surfaces UnauthorizedException', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.instituteLogin('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockLockout.recordFailure).toHaveBeenCalledWith('admin', undefined);
      expect(mockLockout.clearOnSuccess).not.toHaveBeenCalled();
    });

    it('promotes the lockout to ACCOUNT_LOCKED when recordFailure crosses the threshold', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockLockout.recordFailure.mockResolvedValue({ locked: true, remainingAttempts: 0 });

      const err = await authService
        .instituteLogin('admin', 'wrong-password')
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as { code?: string };
      expect(response.code).toBe('ACCOUNT_LOCKED');
    });
  });
});
