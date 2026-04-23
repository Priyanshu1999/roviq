import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';
import { AuthEventService } from './auth-event.service';
import { REDIS_KEYS } from './redis-keys';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 30 * 60; // 30 minutes
const DEFAULT_FAILURE_WINDOW_SECONDS = 15 * 60; // 15 minutes

interface RequestMeta {
  ip?: string;
  userAgent?: string;
  deviceInfo?: string;
}

export interface RecordFailureResult {
  /** True when the account just crossed the threshold and is now locked. */
  locked: boolean;
  /** Remaining attempts before the next failure triggers a lock. 0 once locked. */
  remainingAttempts: number;
}

/**
 * ROV-96 — Brute-force account lockout.
 *
 * Tracks failed login attempts in Redis using two keys (per lowercased
 * username):
 *  - `auth:failed-login:<u>` — sliding 15-minute counter. Each failure resets
 *    the TTL, so the window slides forward on every attempt and only expires
 *    after FAILURE_WINDOW_SECONDS of inactivity.
 *  - `auth:locked:<u>`       — 30-minute lock marker.
 *
 * The increment + TTL-set is performed in a single atomic Lua script so the
 * counter can never leak past its window if the process dies between
 * roundtrips.
 *
 * After MAX_LOGIN_ATTEMPTS failures within the window the account is locked,
 * the failure counter is cleared, and an `account_locked` auth event is
 * emitted. Successful logins clear the failure counter but leave any active
 * lock in place — an attacker who guesses correctly mid-lockout still gets
 * blocked.
 *
 * Username is intentionally lowercased by the caller before being passed to
 * any of these methods so that case-permutation attacks (`Admin`, `ADMIN`,
 * `admin`) all hit the same counter.
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);
  private readonly maxAttempts: number;
  private readonly lockoutSeconds: number;
  private readonly failureWindowSeconds: number;

  /**
   * Atomic INCR + EXPIRE Lua script. Setting EXPIRE on every increment gives
   * us a true sliding window — the counter only expires after
   * FAILURE_WINDOW_SECONDS of inactivity, not FAILURE_WINDOW_SECONDS after the
   * first failure. Doing both in one server-side script means the counter can
   * never leak past its window if the client/process dies between roundtrips.
   */
  private readonly incrAndExpireScript = `
    local current = redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    return current
  `;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly authEventService: AuthEventService,
  ) {
    this.maxAttempts = this.config.get<number>('MAX_LOGIN_ATTEMPTS') ?? DEFAULT_MAX_ATTEMPTS;
    this.lockoutSeconds =
      this.config.get<number>('LOCKOUT_DURATION_SECONDS') ?? DEFAULT_LOCKOUT_SECONDS;
    this.failureWindowSeconds =
      this.config.get<number>('FAILURE_WINDOW_SECONDS') ?? DEFAULT_FAILURE_WINDOW_SECONDS;
  }

  async isLocked(usernameLower: string): Promise<boolean> {
    const exists = await this.redis.exists(`${REDIS_KEYS.LOGIN_LOCKED}${usernameLower}`);
    return exists === 1;
  }

  async recordFailure(usernameLower: string, meta?: RequestMeta): Promise<RecordFailureResult> {
    const failureKey = `${REDIS_KEYS.LOGIN_FAILURES}${usernameLower}`;
    const lockKey = `${REDIS_KEYS.LOGIN_LOCKED}${usernameLower}`;

    const attempts = await this.incrFailureCount(failureKey);

    if (attempts >= this.maxAttempts) {
      await this.redis.set(lockKey, '1', 'EX', this.lockoutSeconds);
      await this.redis.del(failureKey);

      this.authEventService
        .emit({
          type: 'account_locked',
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          deviceInfo: meta?.deviceInfo,
          metadata: {
            username_lower: usernameLower,
            attempts,
            lockout_seconds: this.lockoutSeconds,
          },
        })
        .catch((err) => {
          this.logger.warn(`Failed to emit account_locked auth event: ${String(err)}`);
        });

      return { locked: true, remainingAttempts: 0 };
    }

    return { locked: false, remainingAttempts: this.maxAttempts - attempts };
  }

  async clearOnSuccess(usernameLower: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.LOGIN_FAILURES}${usernameLower}`);
  }

  private async incrFailureCount(key: string): Promise<number> {
    const result = await this.redis.eval(
      this.incrAndExpireScript,
      1,
      key,
      String(this.failureWindowSeconds),
    );
    return Number(result);
  }
}
