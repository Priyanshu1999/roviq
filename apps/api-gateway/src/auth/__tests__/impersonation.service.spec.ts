/**
 * ImpersonationService unit tests.
 *
 * Covers:
 *   - startImpersonation guards (reason length, scope, self, target lookup,
 *     membership check, institute lookup)
 *   - OTP gating (reseller always; platform when require_impersonation_consent;
 *     institute scope never)
 *   - verifyOtp (Redis miss, mismatch with attempt counter & TTL preservation,
 *     max-attempts invalidation, happy path → exchange code, session lookup
 *     edge cases)
 *   - exchangeCode regression (code miss, missing dependencies, happy path)
 *   - endImpersonation regression (state-machine, authorization)
 *
 * `@roviq/database` is mocked at the module boundary so `withAdmin` invokes the
 * service callback against a per-test fluent transaction stub. We don't assert
 * SQL shape — only Redis writes, exception types, NATS emits, and return values.
 *
 * `node:crypto` is mocked so `randomInt`/`randomUUID` are deterministic.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import { AbilityFactory } from '@roviq/casl';
import type { AppAbility } from '@roviq/common-types';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { createMock } from '@roviq/testing';
import { getTableName } from 'drizzle-orm';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEventService } from '../auth-event.service';
import { ImpersonationService } from '../impersonation.service';
import { REDIS_KEYS } from '../redis-keys';

// ── Module-level mocks ─────────────────────────────────────────

vi.mock('@roviq/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roviq/database')>();
  return {
    ...actual,
    withAdmin: vi.fn(async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = (globalThis as { __rovImpTx?: unknown }).__rovImpTx;
      return fn(tx);
    }),
  };
});

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    randomInt: vi.fn(() => 123456),
    randomUUID: vi.fn(() => 'fixed-uuid-0000-0000-0000-000000000000'),
  };
});

// ── Tx stub ────────────────────────────────────────────────────

interface SelectStep {
  table: string;
  rows: unknown[];
}

interface TxStubOpts {
  /** Ordered queue of select results, matched against `from(tableName)` calls. */
  selects?: SelectStep[];
  /** Row(s) returned from `insert().values().returning()` for impersonationSessions. */
  insertReturning?: unknown[];
}

interface TxStub {
  tx: unknown;
  consumed: SelectStep[];
  inserted: { values: unknown }[];
  updated: { values: unknown }[];
}

function tableNameOf(table: unknown): string {
  if (table && typeof table === 'object') {
    try {
      return getTableName(table as Parameters<typeof getTableName>[0]);
    } catch {
      return '';
    }
  }
  return '';
}

function createTx(opts: TxStubOpts = {}): TxStub {
  const selects = [...(opts.selects ?? [])];
  const consumed: SelectStep[] = [];
  const inserted: { values: unknown }[] = [];
  const updated: { values: unknown }[] = [];

  const resolveSelect = (table: unknown): unknown[] => {
    const requested = tableNameOf(table);
    // Match the next queued step whose table name matches; if no match, take
    // the next step regardless (test setup mistakes will surface as wrong
    // shape downstream).
    const idx = selects.findIndex((s) => s.table === requested);
    const step = idx >= 0 ? selects.splice(idx, 1)[0] : selects.shift();
    if (step) consumed.push(step);
    return step?.rows ?? [];
  };

  // The chain must be awaitable both after `.limit(1)` and after `.where(...)`
  // (the role-hierarchy lookup omits `.limit`). We model this by wrapping the
  // returned object in a Proxy so accessing `then` lazily resolves the select —
  // avoiding the `lint/suspicious/noThenProperty` Biome rule that fires on a
  // declared `then` field.
  const makeSelectChain = () => {
    let table: unknown;
    const wrap = <T extends object>(target: T): T =>
      new Proxy(target, {
        get(obj, prop, receiver) {
          if (prop === 'then') {
            const promise = Promise.resolve(resolveSelect(table));
            return promise.then.bind(promise);
          }
          return Reflect.get(obj, prop, receiver);
        },
      });

    const chain: Record<string, unknown> = {};
    chain.from = (t: unknown) => {
      table = t;
      return wrap(chain);
    };
    chain.innerJoin = () => wrap(chain);
    chain.leftJoin = () => wrap(chain);
    chain.where = () => wrap(chain);
    chain.limit = () => Promise.resolve(resolveSelect(table));
    return wrap(chain);
  };

  const tx = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        inserted.push({ values });
        return {
          returning: () => Promise.resolve(opts.insertReturning ?? [{ id: 'session-1' }]),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        updated.push({ values });
        return {
          where: () => Promise.resolve(),
        };
      },
    })),
  };

  return { tx, consumed, inserted, updated };
}

function setTx(tx: unknown): void {
  (globalThis as { __rovImpTx?: unknown }).__rovImpTx = tx;
}

// ── Common factories ───────────────────────────────────────────

const REASON_VALID = 'investigating attendance bug';

function createSubject() {
  const config = createMock<ConfigService>({
    get: vi.fn(),
    getOrThrow: vi.fn(() => 'test-secret'),
  });
  const jwt = createMock<JwtService>({ sign: vi.fn(() => 'fake-jwt') });
  const authEventService = createMock<AuthEventService>({
    emit: vi.fn().mockResolvedValue(undefined),
  });
  const abilityFactory = createMock<AbilityFactory>({
    createForUser: vi.fn().mockResolvedValue({ can: vi.fn(() => true) }),
  });
  const redis = createMock<Redis>({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    getdel: vi.fn().mockResolvedValue(null),
    ttl: vi.fn().mockResolvedValue(120),
  });
  const jetStreamClient = createMock<ClientProxy>({ emit: vi.fn() });

  const service = new ImpersonationService(
    config,
    jwt,
    authEventService,
    abilityFactory,
    createMock(),
    redis,
    jetStreamClient,
  );

  return { service, config, jwt, authEventService, abilityFactory, redis, jetStreamClient };
}

const mockedRandomInt = vi.mocked(randomInt as (min: number, max: number) => number);
const mockedRandomUUID = vi.mocked(randomUUID);

beforeEach(() => {
  vi.clearAllMocks();
  setTx(undefined);
  mockedRandomInt.mockReturnValue(123456);
  mockedRandomUUID.mockReturnValue('fixed-uuid-0000-0000-0000-000000000000');
});

// ── Tests ──────────────────────────────────────────────────────

describe('ImpersonationService', () => {
  describe('startImpersonation — basic guards', () => {
    it('rejects reason shorter than 10 chars with BadRequestException', async () => {
      const { service } = createSubject();
      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', 'short'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown impersonator scope with ForbiddenException', async () => {
      const { service } = createSubject();
      await expect(
        service.startImpersonation('imp-1', 'martian', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-impersonation with BadRequestException', async () => {
      const { service } = createSubject();
      await expect(
        service.startImpersonation('same', 'platform', 'same', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when target user is not found', async () => {
      const { service } = createSubject();
      const { tx } = createTx({ selects: [{ table: 'users', rows: [] }] });
      setTx(tx);
      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when target user is not ACTIVE', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [{ table: 'users', rows: [{ id: 'tgt-1', status: 'SUSPENDED' }] }],
      });
      setTx(tx);
      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when target has no active membership in the target tenant', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          { table: 'memberships', rows: [] },
        ],
      });
      setTx(tx);
      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when target institute is not found', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          { table: 'institutes', rows: [] },
        ],
      });
      setTx(tx);
      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('startImpersonation — OTP gating', () => {
    it('reseller scope owning the institute always requires OTP and emits AUTH_SECURITY', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: false }],
          },
          {
            table: 'reseller_memberships',
            rows: [{ resellerId: 'reseller-1' }],
          },
          { table: 'institutes', rows: [{ resellerId: 'reseller-1' }] },
          { table: 'memberships', rows: [{ userId: 'admin-1' }] },
          {
            table: 'phone_numbers',
            rows: [{ countryCode: '+91', number: '9999999999' }],
          },
        ],
        insertReturning: [{ id: 'session-7' }],
      });
      setTx(tx);

      const result = await service.startImpersonation(
        'imp-1',
        'reseller',
        'tgt-1',
        'tenant-1',
        REASON_VALID,
      );

      expect(result).toEqual({ sessionId: 'session-7', requiresOtp: true });
      expect(redis.set).toHaveBeenCalledWith(
        `${REDIS_KEYS.IMPERSONATION_OTP}session-7`,
        expect.stringContaining('"otp":"123456"'),
        'EX',
        300,
      );
      expect(jetStreamClient.emit).toHaveBeenCalledTimes(1);
      const emitArgs = vi.mocked(jetStreamClient.emit).mock.calls[0];
      expect(emitArgs[0]).toBe(NOTIFICATION_SUBJECTS.AUTH_SECURITY);
      const event = emitArgs[1] as { eventType: string; metadata: { otp: string } };
      expect(event.eventType).toBe('IMPERSONATION_OTP');
      expect(event.metadata.otp).toBe('123456');
    });

    it('reseller scope rejects when institute belongs to a different reseller', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: false }],
          },
          {
            table: 'reseller_memberships',
            rows: [{ resellerId: 'reseller-A' }],
          },
          { table: 'institutes', rows: [{ resellerId: 'reseller-B' }] },
        ],
      });
      setTx(tx);

      await expect(
        service.startImpersonation('imp-1', 'reseller', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(redis.set).not.toHaveBeenCalled();
      expect(jetStreamClient.emit).not.toHaveBeenCalled();
    });

    it('platform scope with consent flag returns sessionId+requiresOtp and dispatches OTP', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: true }],
          },
          { table: 'memberships', rows: [{ userId: 'admin-1' }] },
          {
            table: 'phone_numbers',
            rows: [{ countryCode: '+91', number: '9999999999' }],
          },
        ],
        insertReturning: [{ id: 'session-9' }],
      });
      setTx(tx);

      const result = await service.startImpersonation(
        'imp-1',
        'platform',
        'tgt-1',
        'tenant-1',
        REASON_VALID,
      );

      expect(result).toEqual({ sessionId: 'session-9', requiresOtp: true });
      expect(redis.set).toHaveBeenCalledWith(
        `${REDIS_KEYS.IMPERSONATION_OTP}session-9`,
        expect.any(String),
        'EX',
        300,
      );
      const emitArgs = vi.mocked(jetStreamClient.emit).mock.calls[0];
      const event = emitArgs[1] as { eventType: string };
      expect(event.eventType).toBe('IMPERSONATION_OTP');
    });

    it('platform scope without consent flag skips OTP and returns an exchange code', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: false }],
          },
        ],
        insertReturning: [{ id: 'session-11' }],
      });
      setTx(tx);

      const result = await service.startImpersonation(
        'imp-1',
        'platform',
        'tgt-1',
        'tenant-1',
        REASON_VALID,
      );

      expect(result).toEqual({ code: 'fixed-uuid-0000-0000-0000-000000000000' });
      // Only the exchange-code SET, no OTP SET
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        `${REDIS_KEYS.IMPERSONATION_CODE}fixed-uuid-0000-0000-0000-000000000000`,
        expect.any(String),
        'EX',
        30,
      );
      // No NATS dispatch for IMPERSONATION_OTP
      const otpEmits = vi
        .mocked(jetStreamClient.emit)
        .mock.calls.filter(
          ([, payload]) => (payload as { eventType?: string })?.eventType === 'IMPERSONATION_OTP',
        );
      expect(otpEmits).toHaveLength(0);
    });

    it('institute scope (intra-institute) never requires OTP regardless of consent flag', async () => {
      const { service, redis, jetStreamClient, abilityFactory } = createSubject();
      const stubAbility = createMock<AppAbility>({ can: vi.fn(() => true) });
      vi.mocked(abilityFactory.createForUser).mockResolvedValue(stubAbility);

      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'tgt-mem', tenantId: 'tenant-1', roleId: 'role-student' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: true }],
          },
          // validateIntraInstituteImpersonation: impersonator membership lookup
          {
            table: 'memberships',
            rows: [{ id: 'imp-mem', roleId: 'role-admin' }],
          },
          // role hierarchy lookup
          {
            table: 'roles',
            rows: [
              { id: 'role-admin', name: { en: 'institute_admin' } },
              { id: 'role-student', name: { en: 'student' } },
            ],
          },
        ],
        insertReturning: [{ id: 'session-13' }],
      });
      setTx(tx);

      const result = await service.startImpersonation(
        'imp-1',
        'institute',
        'tgt-1',
        'tenant-1',
        REASON_VALID,
      );

      expect(result).toEqual({ code: 'fixed-uuid-0000-0000-0000-000000000000' });
      const otpSets = vi
        .mocked(redis.set)
        .mock.calls.filter(([key]) => (key as string).startsWith(REDIS_KEYS.IMPERSONATION_OTP));
      expect(otpSets).toHaveLength(0);
      expect(jetStreamClient.emit).not.toHaveBeenCalled();
    });

    it('OTP path: when no institute_admin is found, throws BadRequestException without writing the Redis OTP key', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const otpSetCallsBefore = vi.mocked(redis.set).mock.calls.length;
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: true }],
          },
          // institute_admin lookup returns NULL
          { table: 'memberships', rows: [] },
        ],
        insertReturning: [{ id: 'session-15' }],
      });
      setTx(tx);

      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);

      // After Track A's fix the admin lookup happens BEFORE the Redis write,
      // so the OTP key is never persisted on the no-admin path.
      const otpSetCalls = vi
        .mocked(redis.set)
        .mock.calls.slice(otpSetCallsBefore)
        .filter(([key]) => (key as string).startsWith(REDIS_KEYS.IMPERSONATION_OTP));
      expect(otpSetCalls).toHaveLength(0);
      expect(jetStreamClient.emit).not.toHaveBeenCalled();
    });

    it('OTP path: institute_admin without a primary phone throws BadRequestException without writing the Redis OTP key', async () => {
      const { service, redis, jetStreamClient } = createSubject();
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', status: 'ACTIVE' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', requireImpersonationConsent: true }],
          },
          // institute_admin found
          { table: 'memberships', rows: [{ userId: 'admin-1' }] },
          // primary phone lookup returns empty
          { table: 'phone_numbers', rows: [] },
        ],
        insertReturning: [{ id: 'session-17' }],
      });
      setTx(tx);

      await expect(
        service.startImpersonation('imp-1', 'platform', 'tgt-1', 'tenant-1', REASON_VALID),
      ).rejects.toBeInstanceOf(BadRequestException);

      const otpSetCalls = vi
        .mocked(redis.set)
        .mock.calls.filter(([key]) => (key as string).startsWith(REDIS_KEYS.IMPERSONATION_OTP));
      expect(otpSetCalls).toHaveLength(0);
      expect(jetStreamClient.emit).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    // Track A landed: verifyOtp now resolves the session FIRST, binds the
    // caller to session.impersonatorId, and only then checks the OTP. Every
    // test below must enqueue an `impersonation_sessions` select for that
    // initial lookup.
    const liveSession = {
      id: 'session-1',
      impersonatorId: 'imp-1',
      targetUserId: 'tgt-1',
      targetTenantId: 'tenant-1',
      endedAt: null,
    };

    it('throws UnauthorizedException when the impersonation session no longer exists', async () => {
      const { service } = createSubject();
      const { tx } = createTx({ selects: [{ table: 'impersonation_sessions', rows: [] }] });
      setTx(tx);

      await expect(service.verifyOtp('session-1', '123456', 'imp-1')).rejects.toThrow(
        /session not found/,
      );
    });

    it('throws UnauthorizedException when caller userId does not match session.impersonatorId', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [{ table: 'impersonation_sessions', rows: [liveSession] }],
      });
      setTx(tx);

      await expect(service.verifyOtp('session-1', '123456', 'someone-else')).rejects.toThrow(
        /not authorized for this session/,
      );
    });

    it('throws UnauthorizedException when the impersonation session has already ended', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [
          {
            table: 'impersonation_sessions',
            rows: [{ ...liveSession, endedAt: new Date() }],
          },
        ],
      });
      setTx(tx);

      await expect(service.verifyOtp('session-1', '123456', 'imp-1')).rejects.toThrow(
        /already ended/,
      );
    });

    it('throws UnauthorizedException when OTP key is missing from Redis', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.get).mockResolvedValue(null);
      const { tx } = createTx({
        selects: [{ table: 'impersonation_sessions', rows: [liveSession] }],
      });
      setTx(tx);

      await expect(service.verifyOtp('session-1', '123456', 'imp-1')).rejects.toThrow(
        /expired or not found/,
      );
    });

    it('on mismatch with attempts < MAX-1 increments counter and preserves TTL via SET', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ otp: '111111', attempts: 0 }));
      vi.mocked(redis.ttl).mockResolvedValue(120);
      const { tx } = createTx({
        selects: [{ table: 'impersonation_sessions', rows: [liveSession] }],
      });
      setTx(tx);

      await expect(service.verifyOtp('session-1', '999999', 'imp-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(redis.set).toHaveBeenCalledWith(
        `${REDIS_KEYS.IMPERSONATION_OTP}session-1`,
        JSON.stringify({ otp: '111111', attempts: 1 }),
        'EX',
        120,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('on mismatch reaching MAX_OTP_ATTEMPTS deletes the key and surfaces a max-attempts error', async () => {
      const { service, redis } = createSubject();
      // attempts=2 → next attempt becomes 3 ≥ MAX_OTP_ATTEMPTS
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ otp: '111111', attempts: 2 }));
      const { tx } = createTx({
        selects: [{ table: 'impersonation_sessions', rows: [liveSession] }],
      });
      setTx(tx);

      const err = await service.verifyOtp('session-1', '999999', 'imp-1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toContain('maximum attempts exceeded');
      expect(redis.del).toHaveBeenCalledWith(`${REDIS_KEYS.IMPERSONATION_OTP}session-1`);
      // The mismatch branch must not also persist a fresh attempt counter
      const otpSetCalls = vi
        .mocked(redis.set)
        .mock.calls.filter(([key]) => (key as string).startsWith(REDIS_KEYS.IMPERSONATION_OTP));
      expect(otpSetCalls).toHaveLength(0);
    });

    it('on match deletes the OTP key, issues an exchange code, and returns it', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ otp: '123456', attempts: 0 }));
      const { tx } = createTx({
        selects: [{ table: 'impersonation_sessions', rows: [liveSession] }],
      });
      setTx(tx);

      const result = await service.verifyOtp('session-1', '123456', 'imp-1');
      expect(result).toEqual({ code: 'fixed-uuid-0000-0000-0000-000000000000' });
      expect(redis.del).toHaveBeenCalledWith(`${REDIS_KEYS.IMPERSONATION_OTP}session-1`);
      expect(redis.set).toHaveBeenCalledWith(
        `${REDIS_KEYS.IMPERSONATION_CODE}fixed-uuid-0000-0000-0000-000000000000`,
        expect.any(String),
        'EX',
        30,
      );
    });
  });

  describe('exchangeCode', () => {
    it('throws UnauthorizedException when the code is not in Redis', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.getdel).mockResolvedValue(null);
      await expect(service.exchangeCode('missing-code')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the target user is no longer ACTIVE', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.getdel).mockResolvedValue(
        JSON.stringify({ sessionId: 'session-1', targetUserId: 'tgt-1', tenantId: 'tenant-1' }),
      );
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [] },
          { table: 'memberships', rows: [] },
          { table: 'impersonation_sessions', rows: [] },
          { table: 'institutes', rows: [] },
        ],
      });
      setTx(tx);

      await expect(service.exchangeCode('code-1')).rejects.toThrow(/no longer active/);
    });

    it('throws UnauthorizedException when the target lost their active membership', async () => {
      const { service, redis } = createSubject();
      vi.mocked(redis.getdel).mockResolvedValue(
        JSON.stringify({ sessionId: 'session-1', targetUserId: 'tgt-1', tenantId: 'tenant-1' }),
      );
      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', username: 'student-jane' }] },
          { table: 'memberships', rows: [] },
          {
            table: 'impersonation_sessions',
            rows: [{ id: 'session-1', impersonatorId: 'imp-1' }],
          },
          { table: 'institutes', rows: [{ id: 'tenant-1', name: { en: 'Test' } }] },
        ],
      });
      setTx(tx);

      await expect(service.exchangeCode('code-1')).rejects.toThrow(/no longer has an active/);
    });

    it('happy path returns AccessToken + user + institute', async () => {
      const { service, redis, jwt, authEventService } = createSubject();
      vi.mocked(redis.getdel).mockResolvedValue(
        JSON.stringify({ sessionId: 'session-1', targetUserId: 'tgt-1', tenantId: 'tenant-1' }),
      );
      vi.mocked(jwt.sign).mockReturnValue('fake-jwt');

      const { tx } = createTx({
        selects: [
          { table: 'users', rows: [{ id: 'tgt-1', username: 'student-jane' }] },
          {
            table: 'memberships',
            rows: [{ id: 'mem-1', tenantId: 'tenant-1', roleId: 'role-student' }],
          },
          {
            table: 'impersonation_sessions',
            rows: [{ id: 'session-1', impersonatorId: 'imp-1' }],
          },
          {
            table: 'institutes',
            rows: [{ id: 'tenant-1', name: { en: 'Test Institute' } }],
          },
        ],
      });
      setTx(tx);

      const result = await service.exchangeCode('code-1');
      expect(result).toEqual({
        accessToken: 'fake-jwt',
        user: { id: 'tgt-1', username: 'student-jane' },
        institute: { id: 'tenant-1', name: { en: 'Test Institute' } },
      });
      // Allow the fire-and-forget audit emit a chance to run before assertion.
      await Promise.resolve();
      expect(authEventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'imp-1',
          type: 'impersonation_start',
          tenantId: 'tenant-1',
        }),
      );
    });
  });

  describe('endImpersonation', () => {
    it('throws BadRequestException when the session is not found', async () => {
      const { service } = createSubject();
      const { tx } = createTx({ selects: [{ table: 'impersonation_sessions', rows: [] }] });
      setTx(tx);
      await expect(service.endImpersonation('session-1', 'imp-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the session is already ended', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [
          {
            table: 'impersonation_sessions',
            rows: [
              {
                id: 'session-1',
                impersonatorId: 'imp-1',
                targetUserId: 'tgt-1',
                endedAt: new Date(),
              },
            ],
          },
        ],
      });
      setTx(tx);
      await expect(service.endImpersonation('session-1', 'imp-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when caller is neither impersonator nor target', async () => {
      const { service } = createSubject();
      const { tx } = createTx({
        selects: [
          {
            table: 'impersonation_sessions',
            rows: [
              {
                id: 'session-1',
                impersonatorId: 'imp-1',
                targetUserId: 'tgt-1',
                endedAt: null,
              },
            ],
          },
        ],
      });
      setTx(tx);
      await expect(service.endImpersonation('session-1', 'someone-else')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('happy path: updates row, deletes session cache, emits impersonation_end', async () => {
      const { service, redis, authEventService } = createSubject();
      const { tx, updated } = createTx({
        selects: [
          {
            table: 'impersonation_sessions',
            rows: [
              {
                id: 'session-1',
                impersonatorId: 'imp-1',
                targetUserId: 'tgt-1',
                endedAt: null,
              },
            ],
          },
        ],
      });
      setTx(tx);

      await service.endImpersonation('session-1', 'imp-1');

      expect(updated).toHaveLength(1);
      const setValues = updated[0].values as { endedAt: Date; endedReason: string };
      expect(setValues.endedReason).toBe('manual');
      expect(setValues.endedAt).toBeInstanceOf(Date);
      expect(redis.del).toHaveBeenCalledWith(`${REDIS_KEYS.IMPERSONATION_SESSION}session-1`);
      // Allow the fire-and-forget audit emit a chance to run before assertion.
      await Promise.resolve();
      expect(authEventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'imp-1',
          type: 'impersonation_end',
          metadata: expect.objectContaining({ session_id: 'session-1', ended_reason: 'manual' }),
        }),
      );
    });
  });
});
