import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist shared mock values so they're available inside vi.mock factories
const { mockEmitAuditEvent, mockNoAudit } = vi.hoisted(() => ({
  mockEmitAuditEvent: vi.fn().mockResolvedValue(undefined),
  mockNoAudit: Symbol('NoAudit'),
}));

vi.mock('@roviq/audit', () => ({
  emitAuditEvent: mockEmitAuditEvent,
  NoAudit: mockNoAudit,
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

function createMockReflector() {
  return {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn(),
    getAllAndMerge: vi.fn(),
    getAllAndOverride: vi.fn(),
  };
}

function createMockGqlContext(
  overrides: {
    parentType?: string;
    fieldName?: string;
    user?: Record<string, unknown> | null;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
    args?: Record<string, unknown>;
  } = {},
) {
  const {
    parentType = 'Mutation',
    fieldName = 'createUser',
    user = { userId: 'user-1', tenantId: 'tenant-1' },
    correlationId = 'corr-123',
    ip = '127.0.0.1',
    userAgent = 'test-agent',
    args = { input: { name: 'Test' } },
  } = overrides;

  const req = {
    user,
    correlationId,
    ip,
    headers: { 'user-agent': userAgent },
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

/** Helper: subscribe and wait for the audit emit on next tick */
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

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReflector = createMockReflector();
    interceptor = new AuditInterceptor(mockReflector as never, {} as never);
  });

  it('should skip non-graphql contexts', async () => {
    const { context, gqlContext } = createMockGqlContext();
    context.getType.mockReturnValue('http');
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmitAuditEvent).not.toHaveBeenCalled();
    });
  });

  it('should skip Query operations (only intercept Mutations)', async () => {
    const { context, gqlContext } = createMockGqlContext({ parentType: 'Query' });
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmitAuditEvent).not.toHaveBeenCalled();
    });
  });

  it('should not publish when @NoAudit() is set', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);
    mockReflector.get.mockImplementation((key: unknown) => {
      if (key === mockNoAudit) return true;
      return undefined;
    });

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmitAuditEvent).not.toHaveBeenCalled();
    });
  });

  it('should skip when no user is present', async () => {
    const { context, gqlContext } = createMockGqlContext({ user: null });
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      expect(mockEmitAuditEvent).not.toHaveBeenCalled();
    });
  });

  it('should publish audit event for successful mutation', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(
      interceptor.intercept(context, createMockCallHandler({ id: 'new-entity-1' })),
      () => {
        expect(mockEmitAuditEvent).toHaveBeenCalledOnce();
        const [, event, correlationId] = mockEmitAuditEvent.mock.calls[0];
        expect(correlationId).toBe('corr-123');
        expect(event).toMatchObject({
          tenantId: 'tenant-1',
          userId: 'user-1',
          actorId: 'user-1',
          action: 'createUser',
          actionType: 'CREATE',
          entityType: 'User',
          entityId: 'new-entity-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          source: 'GATEWAY',
        });
      },
    );
  });

  it('should extract correct actionType from mutation name', async () => {
    const testCases = [
      { fieldName: 'createUser', expectedType: 'CREATE', expectedEntity: 'User' },
      { fieldName: 'updateInstitute', expectedType: 'UPDATE', expectedEntity: 'Institute' },
      { fieldName: 'deleteRole', expectedType: 'DELETE', expectedEntity: 'Role' },
      { fieldName: 'restoreMembership', expectedType: 'RESTORE', expectedEntity: 'Membership' },
      { fieldName: 'assignRole', expectedType: 'ASSIGN', expectedEntity: 'Role' },
      { fieldName: 'revokePermission', expectedType: 'REVOKE', expectedEntity: 'Permission' },
      { fieldName: 'doSomething', expectedType: 'UPDATE', expectedEntity: 'doSomething' },
    ];

    for (const { fieldName, expectedType, expectedEntity } of testCases) {
      vi.clearAllMocks();
      const { context, gqlContext } = createMockGqlContext({ fieldName });
      mockedGqlCreate.mockReturnValue(gqlContext as never);

      await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
        expect(mockEmitAuditEvent).toHaveBeenCalledOnce();
        const event = mockEmitAuditEvent.mock.calls[0][1];
        expect(event.actionType).toBe(expectedType);
        expect(event.entityType).toBe(expectedEntity);
      });
    }
  });

  it('should publish audit event for failed mutation', async () => {
    const { context, gqlContext } = createMockGqlContext({ fieldName: 'deleteUser' });
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    const error = new Error('Forbidden: insufficient permissions');

    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, createErrorCallHandler(error)).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          setTimeout(() => {
            try {
              expect(mockEmitAuditEvent).toHaveBeenCalledOnce();
              const event = mockEmitAuditEvent.mock.calls[0][1];
              expect(event.actionType).toBe('DELETE');
              expect(event.entityType).toBe('User');
              expect(event.entityId).toBeUndefined();
              expect(event.metadata).toMatchObject({
                error: 'Forbidden: insufficient permissions',
                errorName: 'Error',
                failed: true,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          }, 0);
        },
        complete: () => reject(new Error('Expected error but got complete')),
      });
    });
  });

  it('should include mutation args in metadata', async () => {
    const { context, gqlContext } = createMockGqlContext({
      args: { input: { name: 'New Institute', slug: 'new-inst' } },
    });
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const event = mockEmitAuditEvent.mock.calls[0][1];
      expect(event.metadata).toEqual({
        args: { input: { name: 'New Institute', slug: 'new-inst' } },
      });
    });
  });

  it('should set changes to null (diff not yet implemented)', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      const event = mockEmitAuditEvent.mock.calls[0][1];
      expect(event.changes).toBeNull();
    });
  });

  it('should not crash when emitAuditEvent rejects', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);
    mockEmitAuditEvent.mockRejectedValueOnce(new Error('NATS down'));

    await subscribeAndExpect(interceptor.intercept(context, createMockCallHandler()), () => {
      // Mutation completes normally despite audit failure — no error thrown to client
    });
  });

  it('should extract entityId from result when available', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(
      interceptor.intercept(context, createMockCallHandler({ id: 'uuid-abc' })),
      () => {
        const event = mockEmitAuditEvent.mock.calls[0][1];
        expect(event.entityId).toBe('uuid-abc');
      },
    );
  });

  it('should handle result without id gracefully', async () => {
    const { context, gqlContext } = createMockGqlContext();
    mockedGqlCreate.mockReturnValue(gqlContext as never);

    await subscribeAndExpect(
      interceptor.intercept(context, createMockCallHandler({ success: true })),
      () => {
        const event = mockEmitAuditEvent.mock.calls[0][1];
        expect(event.entityId).toBeUndefined();
      },
    );
  });
});
