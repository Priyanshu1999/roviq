import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllCircuitBreakers,
  createCircuitBreaker,
  getAllCircuitBreakers,
  getCircuitBreaker,
  removeCircuitBreaker,
} from '../circuit-breaker';

// Reset breaker registry between tests
beforeEach(() => {
  clearAllCircuitBreakers();
});

describe('createCircuitBreaker', () => {
  it('should create a circuit breaker for a given function', async () => {
    const fn = async (x: number) => x * 2;
    const breaker = createCircuitBreaker(fn, { name: 'test-double' });

    const result = await breaker.fire(5);
    expect(result).toBe(10);
  });

  it('should return existing breaker for the same name', () => {
    const fn1 = async () => 'first';
    const fn2 = async () => 'second';

    const breaker1 = createCircuitBreaker(fn1, { name: 'shared' });
    const breaker2 = createCircuitBreaker(fn2, { name: 'shared' });

    expect(breaker1).toBe(breaker2);
  });

  it('should create separate breakers for different names', () => {
    const fn = async () => 'ok';
    const breaker1 = createCircuitBreaker(fn, { name: 'a' });
    const breaker2 = createCircuitBreaker(fn, { name: 'b' });

    expect(breaker1).not.toBe(breaker2);
  });

  it('should apply custom options', async () => {
    const fn = async () => 'ok';
    const breaker = createCircuitBreaker(fn, {
      name: 'custom',
      timeout: 10000,
      errorThresholdPercentage: 75,
      resetTimeout: 60000,
    });

    // Verify breaker works with custom config
    const result = await breaker.fire();
    expect(result).toBe('ok');
  });

  it('should work with default options', async () => {
    const fn = async () => 'ok';
    const breaker = createCircuitBreaker(fn, { name: 'defaults' });

    const result = await breaker.fire();
    expect(result).toBe('ok');
  });

  it('should open circuit after repeated failures', async () => {
    let _callCount = 0;
    const failingFn = async () => {
      _callCount++;
      throw new Error('fail');
    };

    const breaker = createCircuitBreaker(failingFn, {
      name: 'fail-test',
      errorThresholdPercentage: 1, // Open immediately
      resetTimeout: 60000,
      timeout: 1000,
    });

    // Fire enough to trigger circuit open
    for (let i = 0; i < 5; i++) {
      await breaker.fire().catch(() => {});
    }

    expect(breaker.opened).toBe(true);
  });

  it('should transition from open to half-open after resetTimeout', async () => {
    const failingFn = async () => {
      throw new Error('fail');
    };

    const breaker = createCircuitBreaker(failingFn, {
      name: 'half-open-test',
      errorThresholdPercentage: 1,
      resetTimeout: 100, // 100ms for fast test
      timeout: 1000,
    });

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      await breaker.fire().catch(() => {});
    }
    expect(breaker.opened).toBe(true);

    // Wait for resetTimeout to elapse
    await new Promise((r) => setTimeout(r, 150));

    // Circuit should now be half-open
    expect(breaker.halfOpen).toBe(true);
  });

  it('should close circuit after successful call in half-open state', async () => {
    let shouldFail = true;
    const fn = async () => {
      if (shouldFail) throw new Error('fail');
      return 'ok';
    };

    const breaker = createCircuitBreaker(fn, {
      name: 'half-open-close-test',
      errorThresholdPercentage: 1,
      resetTimeout: 100,
      timeout: 1000,
    });

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      await breaker.fire().catch(() => {});
    }
    expect(breaker.opened).toBe(true);

    // Wait for half-open
    await new Promise((r) => setTimeout(r, 150));

    // Now succeed
    shouldFail = false;
    const result = await breaker.fire();
    expect(result).toBe('ok');
    expect(breaker.closed).toBe(true);
  });

  it('should use fallback when provided and circuit is open', async () => {
    const failingFn = async () => {
      throw new Error('fail');
    };

    const breaker = createCircuitBreaker(failingFn, {
      name: 'fallback-test',
      errorThresholdPercentage: 1,
      resetTimeout: 60000,
      fallback: () => 'fallback-value',
    });

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      await breaker.fire().catch(() => {});
    }

    // After opening, should use fallback
    const result = await breaker.fire();
    expect(result).toBe('fallback-value');
  });
});

describe('getCircuitBreaker', () => {
  it('should return undefined for non-existent breaker', () => {
    expect(getCircuitBreaker('nonexistent')).toBeUndefined();
  });

  it('should return the breaker after creation', () => {
    const fn = async () => 'ok';
    createCircuitBreaker(fn, { name: 'findme' });

    const found = getCircuitBreaker('findme');
    expect(found).toBeDefined();
  });
});

describe('getAllCircuitBreakers', () => {
  it('should return all registered breakers', () => {
    const fn = async () => 'ok';
    createCircuitBreaker(fn, { name: 'x' });
    createCircuitBreaker(fn, { name: 'y' });

    const all = getAllCircuitBreakers();
    expect(all.size).toBe(2);
    expect(all.has('x')).toBe(true);
    expect(all.has('y')).toBe(true);
  });
});

describe('removeCircuitBreaker', () => {
  it('should remove and shutdown an existing breaker', () => {
    const fn = async () => 'ok';
    createCircuitBreaker(fn, { name: 'removable' });

    expect(removeCircuitBreaker('removable')).toBe(true);
    expect(getCircuitBreaker('removable')).toBeUndefined();
  });

  it('should return false for non-existent breaker', () => {
    expect(removeCircuitBreaker('nonexistent')).toBe(false);
  });
});

describe('clearAllCircuitBreakers', () => {
  it('should remove all breakers', () => {
    const fn = async () => 'ok';
    createCircuitBreaker(fn, { name: 'a' });
    createCircuitBreaker(fn, { name: 'b' });

    clearAllCircuitBreakers();

    expect(getAllCircuitBreakers().size).toBe(0);
  });
});
