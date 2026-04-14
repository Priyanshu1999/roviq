import { type CallHandler, type ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuditEmitter } from '@roviq/audit';
import { createMock } from '@roviq/testing';
import type { Observable } from 'rxjs';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeDiff,
  extractActionType,
  extractEntityType,
  maskChanges,
  snapshotForDelete,
} from '../audit.helpers';

// ── Mock AuditEmitter ──
const mockEmit = vi.fn().mockResolvedValue(undefined);
const mockAuditEmitter = createMock<AuditEmitter>({ emit: mockEmit });

// ── Mock NoAudit decorator (Reflector.createDecorator returns a symbol-like ref) ──
const { mockNoAudit } = vi.hoisted(() => ({
  mockNoAudit: Symbol('NoAudit'),
}));

vi.mock('@roviq/audit', () => ({
  AuditEmitter: vi.fn(),
  AuditModule: vi.fn(),
  NoAudit: mockNoAudit,
  AuditMask: vi.fn(),
  getAuditMaskedFields: vi.fn().mockReturnValue([]),
}));

vi.mock('@nestjs/graphql', () => ({
  GqlContextType: 'graphql',
  GqlExecutionContext: {
    create: vi.fn(),
  },
}));

import { GqlExecutionContext } from '@nestjs/graphql';
import { AuditInterceptor } from '../audit.interceptor';

const mockedGqlCreate = vi.mocked(GqlExecutionContext.create);

function mockGqlCreate(gqlContext: ReturnType<typeof createMockGqlContext>['gqlContext']): void {
  mockedGqlCreate.mockReturnValue(createMock<GqlExecutionContext>(gqlContext));
}

function createMockReflector() {
  return createMock<Reflector>({
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn(),
    getAllAndMerge: vi.fn(),
    getAllAndOverride: vi.fn(),
  });
}

function createMockGqlContext(
  overrides: {
    parentType?: string;
    fieldName?: string;
    user?: Record<string, unknown> | null;
    correlationId?: string;
    args?: Record<string, unknown>;
  } = {},
) {
  const {
    parentType = 'Mutation',
    fieldName = 'createStudent',
    user = {
      userId: 'user-1',
      scope: 'institute',
      tenantId: 'tenant-1',
      membershipId: 'mem-1',
      roleId: 'role-1',
      type: 'access',
    },
    correlationId = 'corr-123',
    args = { input: { name: 'Test' } },
  } = overrides;

  const req = {
    user,
    correlationId,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
  };

  const context = {
    getType: vi.fn().mockReturnValue('graphql'),
    getHandler: vi.fn().mockReturnValue(() => {}),
    getClass: vi.fn(),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToHttp: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
  } satisfies ExecutionContext;

  const gqlContext = {
    getInfo: () => ({ parentType: { name: parentType }, fieldName }),
    getContext: () => ({ req }),
    getArgs: () => args,
  };

  return { context, gqlContext };
}

function createMockCallHandler(result: unknown = { id: 'entity-1' }): CallHandler {
  return { handle: () => of(result) };
}

function createErrorCallHandler(error: Error): CallHandler {
  return { handle: () => throwError(() => error) };
}

/** Subscribe and wait for audit emit on next tick */
function subscribeAndExpect(observable: Observable<unknown>, expectFn: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    observable.subscribe({
      error: reject,
      complete: () => {
        setTimeout(() => {
          try {
            expectFn();
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 0);
      },
    });
  });
}

// ═══════════════════════════════════════════════════════
// Helper Unit Tests
// ═══════════════════════════════════════════════════════

describe('extractActionType', () => {
  it.each([
    ['createStudent', 'CREATE'],
    ['updateInstitute', 'UPDATE'],
    ['deleteRole', 'DELETE'],
    ['restoreMembership', 'RESTORE'],
    ['assignTeacherToSection', 'ASSIGN'],
    ['revokeSession', 'REVOKE'],
    ['suspendInstitute', 'SUSPEND'],
    ['activateUser', 'ACTIVATE'],
    ['doSomething', 'UPDATE'], // fallback
  ])('%s → %s', (input, expected) => {
    expect(extractActionType(input)).toBe(expected);
  });
});

describe('extractEntityType', () => {
  it.each([
    ['createStudent', 'Student'],
    ['updateInstitute', 'Institute'],
    ['deleteRole', 'Role'],
    ['adminCreateInstitute', 'Institute'],
    ['resellerSuspendInstitute', 'Institute'],
    ['instituteUpdateSection', 'Section'],
  ])('%s → %s', (input, expected) => {
    expect(extractEntityType(input)).toBe(expected);
  });
});

describe('computeDiff', () => {
  it('excludes unchanged fields', () => {
    const diff = computeDiff(
      { name: 'Raj', email: 'a@b.com' },
      { name: 'Rajesh', email: 'a@b.com' },
    );
    expect(diff).toEqual({ name: { old: 'Raj', new: 'Rajesh' } });
  });

  it('returns null when nothing changed', () => {
    expect(computeDiff({ a: 1 }, { a: 1 })).toBeNull();
  });

  it('handles new keys', () => {
    const diff = computeDiff({}, { name: 'New' });
    expect(diff).toEqual({ name: { old: null, new: 'New' } });
  });

  it('handles removed keys', () => {
    const diff = computeDiff({ name: 'Old' }, {});
    expect(diff).toEqual({ name: { old: 'Old', new: null } });
  });

  it('handles null values', () => {
    const diff = computeDiff({ x: null }, { x: 'set' });
    expect(diff).toEqual({ x: { old: null, new: 'set' } });
  });

  it('compares objects by value', () => {
    expect(computeDiff({ a: { b: 1 } }, { a: { b: 1 } })).toBeNull();
    expect(computeDiff({ a: { b: 1 } }, { a: { b: 2 } })).toEqual({
      a: { old: { b: 1 }, new: { b: 2 } },
    });
  });
});

describe('snapshotForDelete', () => {
  it('maps every field to { old: value, new: null }', () => {
    expect(snapshotForDelete({ name: 'Raj', email: 'a@b.com' })).toEqual({
      name: { old: 'Raj', new: null },
      email: { old: 'a@b.com', new: null },
    });
  });
});

describe('maskChanges', () => {
  it('replaces masked field values with [REDACTED]', () => {
    const changes = {
      name: { old: 'Raj', new: 'Rajesh' },
      password: { old: 'secret', new: 'newsecret' },
    };
    expect(maskChanges(changes, ['password'])).toEqual({
      name: { old: 'Raj', new: 'Rajesh' },
      password: { old: '[REDACTED]', new: '[REDACTED]' },
    });
  });

  it('returns unchanged when no masked fields', () => {
    const changes = { name: { old: 'a', new: 'b' } };
    expect(maskChanges(changes, [])).toBe(changes);
  });
});

// ═══════════════════════════════════════════════════════
// Interceptor Tests
// ═══════════════════════════════════════════════════════

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReflector = createMockReflector();
    interceptor = new AuditInterceptor(mockReflector, mockAuditEmitter);
  });

  it('skips non-graphql contexts', async () => {
    const { context, gqlContext } = createMockGqlContext();
    context.getType.mockReturnValue('http');
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  it('skips Query operations', async () => {
    const { context, gqlContext } = createMockGqlContext({ parentType: 'Query' });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  it('skips Subscription operations', async () => {
    const { context, gqlContext } = createMockGqlContext({ parentType: 'Subscription' });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  it('skips mutations with @NoAudit()', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockGqlCreate(gqlContext);
    mockReflector.get.mockImplementation((key: unknown) =>
      key === mockNoAudit ? true : undefined,
    );

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  it('skips when no user is present', async () => {
    const { context, gqlContext } = createMockGqlContext({ user: null });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  // ── Scope-Aware Payload ──

  it('emits scope=institute with tenantId when user.scope=institute', async () => {
    const { context, gqlContext } = createMockGqlContext({
      user: {
        userId: 'u1',
        scope: 'institute',
        tenantId: 'tenant-1',
        membershipId: 'm1',
        roleId: 'r1',
        type: 'access',
      },
    });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit).toHaveBeenCalledOnce();
      const payload = mockEmit.mock.calls[0][0];
      expect(payload.scope).toBe('institute');
      expect(payload.tenantId).toBe('tenant-1');
      expect(payload.resellerId).toBeNull();
    });
  });

  it('emits scope=platform with tenantId=null when user.scope=platform', async () => {
    const { context, gqlContext } = createMockGqlContext({
      user: {
        userId: 'admin-1',
        scope: 'platform',
        membershipId: 'm1',
        roleId: 'r1',
        type: 'access',
      },
    });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const payload = mockEmit.mock.calls[0][0];
      expect(payload.scope).toBe('platform');
      expect(payload.tenantId).toBeNull();
      expect(payload.resellerId).toBeNull();
    });
  });

  it('emits scope=reseller with resellerId when user.scope=reseller', async () => {
    const { context, gqlContext } = createMockGqlContext({
      user: {
        userId: 'reseller-user-1',
        scope: 'reseller',
        resellerId: 'reseller-1',
        membershipId: 'm1',
        roleId: 'r1',
        type: 'access',
      },
    });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const payload = mockEmit.mock.calls[0][0];
      expect(payload.scope).toBe('reseller');
      expect(payload.tenantId).toBeNull();
      expect(payload.resellerId).toBe('reseller-1');
    });
  });

  // ── Impersonation ──

  it('sets actorId=impersonatorId during impersonation', async () => {
    const { context, gqlContext } = createMockGqlContext({
      user: {
        userId: 'target-user',
        scope: 'institute',
        tenantId: 'tenant-1',
        membershipId: 'm1',
        roleId: 'r1',
        type: 'access',
        isImpersonated: true,
        impersonatorId: 'admin-user',
        impersonationSessionId: 'session-1',
      },
    });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const payload = mockEmit.mock.calls[0][0];
      expect(payload.userId).toBe('target-user');
      expect(payload.actorId).toBe('admin-user');
      expect(payload.impersonatorId).toBe('admin-user');
      expect(payload.impersonationSessionId).toBe('session-1');
    });
  });

  it('sets actorId=userId when NOT impersonated', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const payload = mockEmit.mock.calls[0][0];
      expect(payload.userId).toBe('user-1');
      expect(payload.actorId).toBe('user-1');
      expect(payload.impersonatorId).toBeNull();
      expect(payload.impersonationSessionId).toBeNull();
    });
  });

  // ── Success & Error ──

  it('publishes audit event with entityId from result', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(
      interceptor.intercept(context, createMockCallHandler({ id: 'new-id' })),
      () => {
        const payload = mockEmit.mock.calls[0][0];
        expect(payload.entityId).toBe('new-id');
        expect(payload.action).toBe('createStudent');
        expect(payload.actionType).toBe('CREATE');
        expect(payload.entityType).toBe('Student');
        expect(payload.source).toBe('GATEWAY');
        expect(payload.correlationId).toBe('corr-123');
      },
    );
  });

  it('publishes audit event on failed mutation with error details', async () => {
    const { context, gqlContext } = createMockGqlContext({ fieldName: 'deleteStudent' });
    mockGqlCreate(gqlContext);
    const error = new Error('Forbidden');

    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, createErrorCallHandler(error)).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          setTimeout(() => {
            try {
              expect(mockEmit).toHaveBeenCalledOnce();
              const payload = mockEmit.mock.calls[0][0];
              expect(payload.actionType).toBe('DELETE');
              expect(payload.entityType).toBe('Student');
              expect(payload.entityId).toBeNull();
              expect(payload.metadata).toMatchObject({
                error: { code: 'Error', message: 'Forbidden' },
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          }, 0);
        },
        complete: () => reject(new Error('Expected error')),
      });
    });
  });

  it('does not crash when auditEmitter.emit rejects', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockGqlCreate(gqlContext);
    mockEmit.mockRejectedValueOnce(new Error('NATS down'));
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
        expect(mockEmit).toHaveBeenCalledOnce();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to emit audit event'),
          expect.stringContaining('NATS down'),
        );
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('includes correlationId from req', async () => {
    const { context, gqlContext } = createMockGqlContext({ correlationId: 'my-corr-id' });
    mockGqlCreate(gqlContext);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmit.mock.calls[0][0].correlationId).toBe('my-corr-id');
    });
  });
});
