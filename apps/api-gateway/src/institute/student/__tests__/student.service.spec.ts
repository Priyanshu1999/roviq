/**
 * ROV-167 — Unit tests for StudentService (no DB).
 *
 * Mocks `@roviq/database`'s `withTenant`/`withAdmin` wrappers with a
 * chainable Proxy-based fake transaction so the service's Drizzle builder
 * calls resolve against a sequential result queue. Mirrors the pattern in
 * `staff-qualification.spec.ts` — the only way to unit-test a service that
 * speaks fluent Drizzle without hitting a real database.
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue ───────────────────────────────────

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
        if (prop === 'limit' || prop === 'returning' || prop === 'groupBy') return terminal;
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

// Reusable empty-schema columns (accessed by the service for WHERE/set).
const col = new Proxy(
  {},
  {
    get: () => 'col',
  },
);

vi.mock('@roviq/database', () => ({
  DRIZZLE_DB: Symbol('DRIZZLE_DB'),
  withAdmin: vi.fn(mockWithContext),
  withTenant: vi.fn(mockWithContext),
  studentProfiles: col,
  studentAcademics: col,
  userProfiles: col,
  users: col,
  phoneNumbers: col,
  memberships: col,
  roles: col,
  academicYears: col,
  standards: col,
  sections: col,
  instituteConfigs: col,
  tenantSequences: col,
  guardianProfiles: col,
  studentGuardianLinks: col,
  userDocuments: col,
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
  or: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((col: unknown) => col),
  desc: vi.fn((col: unknown) => col),
  ilike: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
  count: vi.fn(() => 'count'),
  sql: Object.assign(
    vi.fn(() => 'sql'),
    { raw: vi.fn(() => 'raw') },
  ),
}));

vi.mock('drizzle-orm/pg-core', () => ({
  alias: vi.fn(() => col),
}));

// Mock status-machine to isolate update() behavior from transition rules.
vi.mock('../student-status-machine', () => ({
  validateStatusTransition: vi.fn(),
}));

interface MockEventBus {
  emit: ReturnType<typeof vi.fn>;
}

async function createService(eventBus: MockEventBus) {
  const mod = await import('../student.service');
  const svc = Object.create(mod.StudentService.prototype);
  svc.db = {};
  svc.eventBus = eventBus;
  svc.logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return svc as InstanceType<typeof mod.StudentService>;
}

describe('StudentService (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    eventBus = { emit: vi.fn() };
    service = await createService(eventBus);
  });

  describe('update', () => {
    it('throws ConflictException CONCURRENT_MODIFICATION on version mismatch', async () => {
      // Update (.returning()) resolves to [] → version mismatch path.
      queueResult([]);
      // throwVersionConflict selects the row → still exists, so conflict.
      queueResult([{ id: 'student-1' }]);

      const promise = service.update('student-1', { version: 1, socialCategory: 'general' });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(
        // Re-run with same queue state (already consumed) would fail — so assert
        // via a single caught error below.
        promise.catch((e) => {
          throw e;
        }),
      ).rejects.toMatchObject({ response: { code: 'CONCURRENT_MODIFICATION' } });
    });

    it('throws NotFoundException when the student does not exist', async () => {
      // Update returns [] → fall through to throwVersionConflict.
      queueResult([]);
      // throwVersionConflict select → not found.
      queueResult([]);

      await expect(
        service.update('missing', { version: 1, socialCategory: 'general' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('emits STUDENT.left when academicStatus transitions to a departure status', async () => {
      // validateStatusChange → current row exists.
      queueResult([{ academicStatus: 'enrolled', tcIssued: false }]);
      // Main update .returning() → one row updated.
      queueResult([{ id: 'student-1' }]);
      // applyUserProfileUpdates: no user-profile fields in input → no select runs.
      // findById select → rows.
      queueResult([
        {
          id: 'student-1',
          academicStatus: 'transferred_out',
          version: 2,
        },
      ]);

      await service.update('student-1', {
        version: 1,
        academicStatus: 'transferred_out',
        tcNumber: 'TC-001',
      });

      expect(eventBus.emit).toHaveBeenCalledWith(
        'STUDENT.left',
        expect.objectContaining({
          studentProfileId: 'student-1',
          reason: 'transferred_out',
          tcNumber: 'TC-001',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('does NOT emit STUDENT.left for a non-departure status change', async () => {
      queueResult([{ academicStatus: 'enrolled', tcIssued: false }]);
      queueResult([{ id: 'student-1' }]);
      queueResult([{ id: 'student-1', academicStatus: 'graduated', version: 2 }]);

      await service.update('student-1', {
        version: 1,
        academicStatus: 'graduated',
      });

      expect(eventBus.emit).not.toHaveBeenCalledWith('STUDENT.left', expect.anything());
    });
  });

  describe('statistics', () => {
    it('aggregates totals, byStatus, bySection, byStandard, byGender, byCategory', async () => {
      // Six sequential SELECTs in withTenant — queue in order.
      queueResult([{ total: 42 }]);
      queueResult([
        { status: 'enrolled', count: 30 },
        { status: 'graduated', count: 12 },
      ]);
      queueResult([{ sectionId: 'sec-1', count: 20 }]);
      queueResult([{ standardId: 'std-1', count: 25 }]);
      queueResult([
        { gender: 'male', count: 22 },
        { gender: null, count: 2 },
      ]);
      queueResult([{ category: 'general', count: 40 }]);

      const result = await service.statistics();

      expect(result.total).toBe(42);
      expect(result.byStatus).toEqual([
        { status: 'enrolled', count: 30 },
        { status: 'graduated', count: 12 },
      ]);
      expect(result.bySection).toEqual([{ sectionId: 'sec-1', count: 20 }]);
      expect(result.byStandard).toEqual([{ standardId: 'std-1', count: 25 }]);
      // Null gender is normalized to 'unknown'.
      expect(result.byGender).toEqual([
        { gender: 'male', count: 22 },
        { gender: 'unknown', count: 2 },
      ]);
      expect(result.byCategory).toEqual([{ category: 'general', count: 40 }]);
    });
  });
});
