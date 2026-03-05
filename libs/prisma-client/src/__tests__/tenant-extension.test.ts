import { describe, expect, it } from 'vitest';
import { isValidTenantId, tenantContext } from '../tenant-extension';

describe('isValidTenantId', () => {
  it('should accept a valid UUID v4', () => {
    expect(isValidTenantId('dfcab71f-4038-435a-8ca7-160f7ab312fe')).toBe(true);
  });

  it('should accept uppercase UUIDs', () => {
    expect(isValidTenantId('DFCAB71F-4038-435A-8CA7-160F7AB312FE')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidTenantId('')).toBe(false);
  });

  it('should reject non-UUID strings', () => {
    expect(isValidTenantId('not-a-uuid')).toBe(false);
    expect(isValidTenantId('12345')).toBe(false);
  });

  it('should reject UUIDs with wrong length', () => {
    expect(isValidTenantId('dfcab71f-4038-435a-8ca7-160f7ab312f')).toBe(false); // one char short
    expect(isValidTenantId('dfcab71f-4038-435a-8ca7-160f7ab312fea')).toBe(false); // one char long
  });

  it('should reject UUIDs with invalid characters', () => {
    expect(isValidTenantId('dfcab71f-4038-435a-8ca7-160f7ab312gx')).toBe(false);
  });
});

describe('tenantContext', () => {
  it('should return undefined when no context is set', () => {
    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('should return tenant ID within a run context', async () => {
    await tenantContext.run({ tenantId: 'test-tenant-id' }, async () => {
      const store = tenantContext.getStore();
      expect(store).toBeDefined();
      expect(store?.tenantId).toBe('test-tenant-id');
    });
  });

  it('should isolate contexts between concurrent runs', async () => {
    const results: string[] = [];

    await Promise.all([
      tenantContext.run({ tenantId: 'tenant-a' }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(tenantContext.getStore()!.tenantId);
      }),
      tenantContext.run({ tenantId: 'tenant-b' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(tenantContext.getStore()!.tenantId);
      }),
    ]);

    expect(results).toContain('tenant-a');
    expect(results).toContain('tenant-b');
  });

  it('should maintain correct context in nested runs', async () => {
    await tenantContext.run({ tenantId: 'outer' }, async () => {
      expect(tenantContext.getStore()?.tenantId).toBe('outer');

      await tenantContext.run({ tenantId: 'inner' }, async () => {
        expect(tenantContext.getStore()?.tenantId).toBe('inner');
      });

      // Outer context should be restored
      expect(tenantContext.getStore()?.tenantId).toBe('outer');
    });
  });

  it('should clean up context even when callback throws', async () => {
    await tenantContext
      .run({ tenantId: 'error-tenant' }, async () => {
        throw new Error('simulated error');
      })
      .catch(() => {});

    expect(tenantContext.getStore()).toBeUndefined();
  });

  it('should not leak context outside of run', async () => {
    await tenantContext.run({ tenantId: 'temp' }, async () => {
      expect(tenantContext.getStore()?.tenantId).toBe('temp');
    });
    expect(tenantContext.getStore()).toBeUndefined();
  });
});
