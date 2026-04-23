import { ConfigService } from '@nestjs/config';
import { createMock } from '@roviq/testing';
import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { AuthEventService } from '../auth-event.service';
import { LoginLockoutService } from '../login-lockout.service';
import { REDIS_KEYS } from '../redis-keys';

const USERNAME = 'admin';
const FAILURE_KEY = `${REDIS_KEYS.LOGIN_FAILURES}${USERNAME}`;
const LOCK_KEY = `${REDIS_KEYS.LOGIN_LOCKED}${USERNAME}`;

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 30 * 60;
const DEFAULT_FAILURE_WINDOW_SECONDS = 15 * 60;

function createMockRedis() {
  return createMock<Redis>({
    exists: vi.fn(),
    eval: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  });
}

function createMockAuthEventService() {
  return createMock<AuthEventService>({
    emit: vi.fn().mockResolvedValue(undefined),
  });
}

interface ConfigOverrides {
  MAX_LOGIN_ATTEMPTS?: number;
  LOCKOUT_DURATION_SECONDS?: number;
  FAILURE_WINDOW_SECONDS?: number;
}

function createMockConfigService(overrides: ConfigOverrides = {}) {
  return createMock<ConfigService>({
    get: vi.fn((key: string) => (overrides as Record<string, number | undefined>)[key]),
  });
}

function buildService(overrides: ConfigOverrides = {}) {
  const redis = createMockRedis();
  const authEvents = createMockAuthEventService();
  const config = createMockConfigService(overrides);
  const service = new LoginLockoutService(redis, config, authEvents);
  return { service, redis, authEvents, config };
}

describe('LoginLockoutService', () => {
  describe('isLocked', () => {
    it('returns true when EXISTS returns 1', async () => {
      const { service, redis } = buildService();
      vi.mocked(redis.exists).mockResolvedValue(1);

      await expect(service.isLocked(USERNAME)).resolves.toBe(true);
      expect(redis.exists).toHaveBeenCalledWith(LOCK_KEY);
    });

    it('returns false when EXISTS returns 0', async () => {
      const { service, redis } = buildService();
      vi.mocked(redis.exists).mockResolvedValue(0);

      await expect(service.isLocked(USERNAME)).resolves.toBe(false);
      expect(redis.exists).toHaveBeenCalledWith(LOCK_KEY);
    });
  });

  describe('recordFailure', () => {
    it('on the 1st failure returns not-locked with remainingAttempts=4 and runs the atomic INCR+EXPIRE eval', async () => {
      const { service, redis, authEvents } = buildService();
      vi.mocked(redis.eval).mockResolvedValue(1);

      const result = await service.recordFailure(USERNAME);

      expect(result).toEqual({ locked: false, remainingAttempts: DEFAULT_MAX_ATTEMPTS - 1 });
      expect(redis.eval).toHaveBeenCalledTimes(1);
      // Lua script body + 1 key + key + window-seconds (stringified).
      const evalCall = vi.mocked(redis.eval).mock.calls[0];
      expect(evalCall?.[0]).toEqual(expect.stringContaining('INCR'));
      expect(evalCall?.[0]).toEqual(expect.stringContaining('EXPIRE'));
      expect(evalCall?.[1]).toBe(1);
      expect(evalCall?.[2]).toBe(FAILURE_KEY);
      expect(evalCall?.[3]).toBe(String(DEFAULT_FAILURE_WINDOW_SECONDS));
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
      expect(authEvents.emit).not.toHaveBeenCalled();
    });

    it('on the 4th failure returns not-locked with remainingAttempts=1', async () => {
      const { service, redis, authEvents } = buildService();
      vi.mocked(redis.eval).mockResolvedValue(4);

      const result = await service.recordFailure(USERNAME);

      expect(result).toEqual({ locked: false, remainingAttempts: 1 });
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
      expect(authEvents.emit).not.toHaveBeenCalled();
    });

    it('on the 5th failure locks the account, clears the failure key, and emits account_locked', async () => {
      const { service, redis, authEvents } = buildService();
      vi.mocked(redis.eval).mockResolvedValue(5);

      const meta = { ip: '10.0.0.1', userAgent: 'jest', deviceInfo: 'desktop' };
      const result = await service.recordFailure(USERNAME, meta);

      expect(result).toEqual({ locked: true, remainingAttempts: 0 });
      expect(redis.set).toHaveBeenCalledWith(LOCK_KEY, '1', 'EX', DEFAULT_LOCKOUT_SECONDS);
      expect(redis.del).toHaveBeenCalledWith(FAILURE_KEY);

      // Allow the fire-and-forget emit promise to settle.
      await Promise.resolve();
      expect(authEvents.emit).toHaveBeenCalledWith({
        type: 'account_locked',
        ip: '10.0.0.1',
        userAgent: 'jest',
        deviceInfo: 'desktop',
        metadata: {
          username_lower: USERNAME,
          attempts: 5,
          lockout_seconds: DEFAULT_LOCKOUT_SECONDS,
        },
      });
    });

    it('on the 6th failure (already past threshold) still reports locked with remainingAttempts=0 — never negative', async () => {
      const { service, redis } = buildService();
      vi.mocked(redis.eval).mockResolvedValue(6);

      const result = await service.recordFailure(USERNAME);

      expect(result).toEqual({ locked: true, remainingAttempts: 0 });
      expect(redis.set).toHaveBeenCalledWith(LOCK_KEY, '1', 'EX', DEFAULT_LOCKOUT_SECONDS);
      expect(redis.del).toHaveBeenCalledWith(FAILURE_KEY);
    });

    it('does not propagate AuthEventService.emit failures — caller still gets the RecordFailureResult', async () => {
      const { service, redis, authEvents } = buildService();
      vi.mocked(redis.eval).mockResolvedValue(5);
      vi.mocked(authEvents.emit).mockRejectedValue(new Error('boom'));

      const result = await service.recordFailure(USERNAME);

      expect(result).toEqual({ locked: true, remainingAttempts: 0 });
      // Allow rejection to flush so an unhandled-rejection wouldn't escape.
      await Promise.resolve();
      await Promise.resolve();
      expect(authEvents.emit).toHaveBeenCalled();
    });
  });

  describe('clearOnSuccess', () => {
    it('DELs the failure key and never touches the lock key', async () => {
      const { service, redis } = buildService();

      await service.clearOnSuccess(USERNAME);

      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith(FAILURE_KEY);
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.exists).not.toHaveBeenCalled();
    });
  });

  describe('ConfigService env overrides', () => {
    it('locks at the 3rd failure when MAX_LOGIN_ATTEMPTS=3', async () => {
      const { service, redis, authEvents } = buildService({ MAX_LOGIN_ATTEMPTS: 3 });

      // 1st failure → not locked, 2 remaining.
      vi.mocked(redis.eval).mockResolvedValueOnce(1);
      await expect(service.recordFailure(USERNAME)).resolves.toEqual({
        locked: false,
        remainingAttempts: 2,
      });

      // 2nd failure → not locked, 1 remaining.
      vi.mocked(redis.eval).mockResolvedValueOnce(2);
      await expect(service.recordFailure(USERNAME)).resolves.toEqual({
        locked: false,
        remainingAttempts: 1,
      });

      // 3rd failure → locked.
      vi.mocked(redis.eval).mockResolvedValueOnce(3);
      const result = await service.recordFailure(USERNAME);
      expect(result).toEqual({ locked: true, remainingAttempts: 0 });
      expect(redis.set).toHaveBeenCalledWith(LOCK_KEY, '1', 'EX', DEFAULT_LOCKOUT_SECONDS);

      await Promise.resolve();
      expect(authEvents.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'account_locked',
          metadata: expect.objectContaining({ attempts: 3 }),
        }),
      );
    });

    it('honours LOCKOUT_DURATION_SECONDS and FAILURE_WINDOW_SECONDS overrides', async () => {
      const { service, redis } = buildService({
        LOCKOUT_DURATION_SECONDS: 60,
        FAILURE_WINDOW_SECONDS: 120,
      });
      vi.mocked(redis.eval).mockResolvedValue(5);

      await service.recordFailure(USERNAME);

      const evalCall = vi.mocked(redis.eval).mock.calls[0];
      expect(evalCall?.[3]).toBe('120');
      expect(redis.set).toHaveBeenCalledWith(LOCK_KEY, '1', 'EX', 60);
    });
  });
});
