/**
 * ROV-169 — Unit tests for StaffQualificationService (no DB).
 *
 * Pure unit test that mocks `@roviq/database`'s `withTenant`/`withAdmin`
 * wrappers and provides a chainable Proxy-based fake transaction so the
 * service's Drizzle builder calls resolve to queued results. This pattern
 * mirrors `guardian-linking.spec.ts` — the only way to unit-test a service
 * that speaks fluent Drizzle without hitting a real database.
 */

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue (shared between `withTenant` and `withAdmin`) ──

const resultQueue: unknown[] = [];
let queueIndex = 0;

function queueResult(result: unknown) {
  resultQueue.push(result);
}

function resetQueue() {
  resultQueue.length = 0;
  queueIndex = 0;
}

function nextResult(): unknown {
  const result = resultQueue[queueIndex] ?? [];
  queueIndex++;
  return result;
}

function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
        return vi.fn(() => chain);
      },
    },
  );
  return chain;
}

async function mockWithContext(_db: unknown, ...args: unknown[]) {
  const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
  return fn(createMockTx());
}

vi.mock('@roviq/database', () => ({
  DRIZZLE_DB: Symbol('DRIZZLE_DB'),
  withAdmin: vi.fn(mockWithContext),
  withTenant: vi.fn(mockWithContext),
  staffQualifications: {
    id: 'id',
    staffProfileId: 'staff_profile_id',
    tenantId: 'tenant_id',
    type: 'type',
    degreeName: 'degree_name',
  },
}));

vi.mock('@roviq/common-types', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'tenant-1',
    userId: 'user-1',
    correlationId: 'test',
  })),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  asc: vi.fn((col: unknown) => col),
}));

async function createService() {
  const mod = await import('../staff-qualification.service');
  const svc = Object.create(mod.StaffQualificationService.prototype);
  svc.db = {};
  return svc as InstanceType<typeof mod.StaffQualificationService>;
}

describe('StaffQualificationService (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('listForStaff returns the rows from the mocked select chain', async () => {
    const rows = [
      { id: 'q1', degreeName: 'B.Ed', type: 'academic' },
      { id: 'q2', degreeName: 'M.Sc', type: 'academic' },
    ];
    queueResult(rows);

    const result = await service.listForStaff('staff-1');

    expect(result).toEqual(rows);
  });

  it('create returns the inserted row from the returning chain', async () => {
    const inserted = {
      id: 'q3',
      staffProfileId: 'staff-1',
      tenantId: 'tenant-1',
      type: 'academic',
      degreeName: 'B.Ed',
    };
    queueResult([inserted]);

    const result = await service.create({
      staffProfileId: 'staff-1',
      type: 'academic',
      degreeName: 'B.Ed',
    });

    expect(result).toEqual(inserted);
  });

  it('update returns the updated row', async () => {
    const updated = {
      id: 'q4',
      staffProfileId: 'staff-1',
      type: 'academic',
      degreeName: 'B.Ed (Revised)',
    };
    queueResult([updated]);

    const result = await service.update('q4', { degreeName: 'B.Ed (Revised)' });

    expect(result).toEqual(updated);
  });

  it('update throws NotFoundException when no row matches', async () => {
    queueResult([]);

    await expect(service.update('missing', { degreeName: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('delete returns true on success', async () => {
    queueResult([{ id: 'q5' }]);

    const result = await service.delete('q5');

    expect(result).toBe(true);
  });

  it('delete throws NotFoundException when no row matches', async () => {
    queueResult([]);

    await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
  });
});
