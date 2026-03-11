import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../../auth/auth.service';
import { PasskeyService } from '../passkey.service';

// Mock @simplewebauthn/server
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

function createMockRedis() {
  return {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  };
}

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    authProvider: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function createMockAuthService() {
  return {
    verifyPassword: vi.fn(),
    loginByUserId: vi.fn(),
  };
}

function createMockConfigService() {
  const envs: Record<string, string> = {
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_RP_NAME: 'Roviq',
    ALLOWED_ORIGINS: 'http://localhost:4200,http://localhost:4300',
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

describe('PasskeyService', () => {
  let service: PasskeyService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockAuth: ReturnType<typeof createMockAuthService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockPrisma = createMockPrisma();
    mockAuth = createMockAuthService();
    mockConfig = createMockConfigService();

    service = new PasskeyService(
      mockConfig as unknown as ConfigService,
      mockAuth as unknown as AuthService,
      mockPrisma as unknown as AdminPrismaClient,
      mockRedis as unknown as Redis,
    );
  });

  describe('generateRegistrationOptions', () => {
    it('should reject if password is wrong', async () => {
      mockAuth.verifyPassword.mockResolvedValue(false);

      await expect(service.generateRegistrationOptions('user-1', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should generate options and store challenge in Redis', async () => {
      mockAuth.verifyPassword.mockResolvedValue(true);
      mockPrisma.authProvider.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'admin' });
      const mockOptions = { challenge: 'test-challenge', user: { id: 'webauthn-user-id' } };
      (generateRegistrationOptions as ReturnType<typeof vi.fn>).mockResolvedValue(mockOptions);

      const result = await service.generateRegistrationOptions('user-1', 'correct-password');

      expect(result).toEqual(mockOptions);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'webauthn:reg:user-1',
        'test-challenge',
        'EX',
        300,
      );
    });

    it('should exclude existing passkeys from registration options', async () => {
      mockAuth.verifyPassword.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'admin' });
      mockPrisma.authProvider.findMany.mockResolvedValue([
        {
          providerUserId: 'existing-cred-id',
          providerData: { transports: ['internal'] },
        },
      ]);
      (generateRegistrationOptions as ReturnType<typeof vi.fn>).mockResolvedValue({
        challenge: 'c',
        user: { id: 'uid' },
      });

      await service.generateRegistrationOptions('user-1', 'correct-password');

      expect(generateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: [{ id: 'existing-cred-id', transports: ['internal'] }],
        }),
      );
    });
  });

  describe('verifyRegistration', () => {
    it('should throw if challenge not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyRegistration('user-1', {} as any, 'My Key')).rejects.toThrow(
        'Challenge expired',
      );
    });

    it('should throw if verification fails', async () => {
      mockRedis.get.mockResolvedValue('stored-challenge');
      (verifyRegistrationResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        verified: false,
      });

      await expect(service.verifyRegistration('user-1', {} as any, 'My Key')).rejects.toThrow(
        'Verification failed',
      );
    });

    it('should create AuthProvider row on success', async () => {
      mockRedis.get.mockResolvedValue('stored-challenge');
      (verifyRegistrationResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-id',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
      mockPrisma.authProvider.create.mockResolvedValue({
        id: 'ap-1',
        providerData: {
          name: 'My Key',
          deviceType: 'multiDevice',
          backedUp: true,
          registeredAt: '2026-03-10T00:00:00.000Z',
          lastUsedAt: null,
        },
      });

      const result = await service.verifyRegistration('user-1', {} as any, 'My Key');

      expect(result.name).toBe('My Key');
      expect(mockRedis.del).toHaveBeenCalledWith('webauthn:reg:user-1');
      expect(mockPrisma.authProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            provider: 'passkey',
            providerUserId: 'cred-id',
          }),
        }),
      );
    });
  });

  describe('generateAuthOptions', () => {
    it('should throw generic error when user has no passkeys', async () => {
      mockPrisma.authProvider.findMany.mockResolvedValue([]);

      await expect(service.generateAuthOptions('nonexistent')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should store challenge with random challengeId and return it', async () => {
      mockPrisma.authProvider.findMany.mockResolvedValue([
        { providerUserId: 'cred-1', providerData: { transports: ['internal'] } },
      ]);
      (generateAuthenticationOptions as ReturnType<typeof vi.fn>).mockResolvedValue({
        challenge: 'auth-challenge',
      });

      const result = await service.generateAuthOptions('admin');

      expect(result.challengeId).toBeDefined();
      expect(result.optionsJSON).toEqual({ challenge: 'auth-challenge' });
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^webauthn:auth:/),
        expect.stringContaining('auth-challenge'),
        'EX',
        300,
      );
    });
  });

  describe('verifyAuth', () => {
    it('should throw if challenge not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyAuth('challenge-id', {} as any)).rejects.toThrow(
        'Challenge expired',
      );
    });

    it('should throw if passkey not found for credential', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ challenge: 'c' }));
      mockPrisma.authProvider.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyAuth('challenge-id', { id: 'unknown-cred' } as any),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should update counter and lastUsedAt, then call loginByUserId', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ challenge: 'stored-challenge' }));
      mockPrisma.authProvider.findFirst.mockResolvedValue({
        id: 'ap-1',
        userId: 'user-1',
        providerUserId: 'cred-1',
        providerData: {
          publicKey: 'AQID', // base64url of [1,2,3]
          counter: 0,
          transports: ['internal'],
          name: 'My Key',
          deviceType: 'multiDevice',
          backedUp: true,
          webauthnUserID: 'wuid',
          registeredAt: '2026-03-10T00:00:00.000Z',
          lastUsedAt: null,
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
      (verifyAuthenticationResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      mockPrisma.authProvider.update.mockResolvedValue({});
      mockAuth.loginByUserId.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'user-1' },
      });

      const result = await service.verifyAuth('challenge-id', { id: 'cred-1' } as any);

      expect(result.accessToken).toBe('at');
      expect(mockRedis.del).toHaveBeenCalledWith('webauthn:auth:challenge-id');
      expect(mockPrisma.authProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ap-1' },
          data: expect.objectContaining({
            providerData: expect.objectContaining({
              counter: 1,
              lastUsedAt: expect.any(String),
            }),
          }),
        }),
      );
      expect(mockAuth.loginByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('myPasskeys', () => {
    it('should return formatted passkey list', async () => {
      mockPrisma.authProvider.findMany.mockResolvedValue([
        {
          id: 'ap-1',
          providerData: {
            name: 'MacBook',
            deviceType: 'multiDevice',
            backedUp: true,
            registeredAt: '2026-03-10T00:00:00.000Z',
            lastUsedAt: null,
          },
        },
      ]);

      const result = await service.myPasskeys('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MacBook');
      expect(result[0].id).toBe('ap-1');
    });
  });

  describe('removePasskey', () => {
    it('should throw if passkey is last auth method and user has no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null });
      mockPrisma.authProvider.count.mockResolvedValue(0);

      await expect(service.removePasskey('user-1', 'ap-1')).rejects.toThrow(
        'Cannot remove your only authentication method',
      );
    });

    it('should allow removal if user still has a password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$...' });
      mockPrisma.authProvider.count.mockResolvedValue(0);
      mockPrisma.authProvider.deleteMany.mockResolvedValue({ count: 1 });

      await service.removePasskey('user-1', 'ap-1');

      expect(mockPrisma.authProvider.deleteMany).toHaveBeenCalledWith({
        where: { id: 'ap-1', userId: 'user-1' },
      });
    });

    it('should allow removal if user has other passkeys', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null });
      mockPrisma.authProvider.count.mockResolvedValue(1);
      mockPrisma.authProvider.deleteMany.mockResolvedValue({ count: 1 });

      await service.removePasskey('user-1', 'ap-1');

      expect(mockPrisma.authProvider.deleteMany).toHaveBeenCalled();
    });

    it('should throw if passkey does not belong to user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: '$argon2id$...' });
      mockPrisma.authProvider.count.mockResolvedValue(0);
      mockPrisma.authProvider.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removePasskey('user-1', 'other-users-ap')).rejects.toThrow(
        'Passkey not found',
      );
    });
  });
});
