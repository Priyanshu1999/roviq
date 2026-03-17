import { describe, expect, it } from 'vitest';
import { Semaphore } from '../semaphore';

describe('Semaphore', () => {
  it('allows up to max concurrent acquisitions', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();

    let resolved = false;
    const p = sem.acquire().then(() => {
      resolved = true;
    });

    // Third acquire should be blocked
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    sem.release();
    await p;
    expect(resolved).toBe(true);
  });

  it('degrades to sequential for max=1', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();
    const p1 = sem.acquire().then(() => {
      order.push(1);
      sem.release();
    });
    const p2 = sem.acquire().then(() => {
      order.push(2);
      sem.release();
    });

    sem.release();
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('handles rapid acquire/release cycles', async () => {
    const sem = new Semaphore(3);
    let maxConcurrent = 0;
    let current = 0;

    const tasks = Array.from({ length: 10 }, async (_, i) => {
      await sem.acquire();
      current++;
      if (current > maxConcurrent) maxConcurrent = current;
      // Simulate async work
      await new Promise((r) => setTimeout(r, 5));
      current--;
      sem.release();
      return i;
    });

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(10);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('immediately resolves when capacity is available', async () => {
    const sem = new Semaphore(5);

    // All five should resolve immediately (no blocking)
    await sem.acquire();
    await sem.acquire();
    await sem.acquire();
    await sem.acquire();
    await sem.acquire();

    // Release one, next should resolve immediately
    sem.release();
    await sem.acquire();
  });

  it('processes waiters in FIFO order', async () => {
    const sem = new Semaphore(1);
    const order: string[] = [];

    await sem.acquire();

    const p1 = sem.acquire().then(() => {
      order.push('first');
      sem.release();
    });
    const p2 = sem.acquire().then(() => {
      order.push('second');
      sem.release();
    });
    const p3 = sem.acquire().then(() => {
      order.push('third');
      sem.release();
    });

    sem.release();
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual(['first', 'second', 'third']);
  });
});
