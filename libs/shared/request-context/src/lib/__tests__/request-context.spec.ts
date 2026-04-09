import { describe, expect, it } from 'vitest';
import { getRequestContext, type RequestContext, requestContext } from '../request-context';
import { withTestContext } from '../test-utils';

const MOCK_CTX: RequestContext = {
  userId: 'u-1',
  tenantId: 't-1',
  resellerId: null,
  scope: 'institute',
  impersonatorId: null,
  correlationId: 'c-1',
};

describe('getRequestContext', () => {
  it('throws outside AsyncLocalStorage context', () => {
    expect(() => getRequestContext()).toThrow(/No request context/);
  });

  it('returns the store inside requestContext.run', () => {
    requestContext.run(MOCK_CTX, () => {
      const ctx = getRequestContext();
      expect(ctx.userId).toBe('u-1');
      expect(ctx.tenantId).toBe('t-1');
    });
  });
});

describe('withTestContext', () => {
  it('provides default test values', () => {
    withTestContext(() => {
      const ctx = getRequestContext();
      expect(ctx.userId).toBe('test-user-id');
      expect(ctx.tenantId).toBe('test-tenant-id');
      expect(ctx.scope).toBe('institute');
    });
  });

  it('accepts overrides', () => {
    withTestContext(
      () => {
        const ctx = getRequestContext();
        expect(ctx.userId).toBe('custom-user');
        expect(ctx.scope).toBe('platform');
      },
      { userId: 'custom-user', scope: 'platform' },
    );
  });

  it('supports async functions', async () => {
    const result = await withTestContext(async () => {
      const ctx = getRequestContext();
      return ctx.correlationId;
    });
    expect(result).toBe('test-correlation-id');
  });
});
