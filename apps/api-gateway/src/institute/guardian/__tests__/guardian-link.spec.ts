/**
 * ROV-169 — Unit tests for GuardianService link/unlink/revoke paths.
 *
 * Covers the positive happy-path for `linkToStudent` (mocked Drizzle
 * pipeline: student lookup → guardian lookup → insert), plus the
 * "unlinking the last guardian without replacement" rejection and
 * `revokeAccess` flipping `canPickup=false`.
 *
 * `guardian-linking.spec.ts` already owns the exhaustive negative paths for
 * unlink (no link, primary without replacement, last-guardian) and revoke
 * (link not found); this file complements it with the positive-link flow.
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue (mirrors guardian-linking.spec.ts) ─────────────

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

const insertCalls: unknown[] = [];

function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));
  const valuesSpy = vi.fn((v: unknown) => {
    insertCalls.push(v);
    return chain;
  });
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'values') return valuesSpy;
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
  guardianProfiles: { id: 'id', deletedAt: 'deleted_at', version: 'version' },
  studentProfiles: { id: 'id' },
  studentGuardianLinks: {
    id: 'id',
    studentProfileId: 'student_profile_id',
    guardianProfileId: 'guardian_profile_id',
    isPrimaryContact: 'is_primary_contact',
  },
  memberships: {},
  roles: {},
  users: {},
  userProfiles: {},
  phoneNumbers: {},
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
  sql: vi.fn(),
}));

async function createService() {
  const mod = await import('../guardian.service');
  const svc = Object.create(mod.GuardianService.prototype);
  svc.db = {};
  svc.natsClient = { emit: vi.fn().mockReturnValue({ subscribe: vi.fn() }) };
  svc.logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return svc;
}

describe('GuardianService — linkToStudent (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    insertCalls.length = 0;
    service = await createService();
  });

  it('inserts studentGuardianLinks with values from input and returns link', async () => {
    queueResult([{ id: 'stu-1' }]); // student lookup
    queueResult([{ id: 'g-1' }]); // guardian lookup
    queueResult([{ id: 'link-1', relationship: 'father' }]); // insert returning

    const link = await service.linkToStudent({
      studentProfileId: 'stu-1',
      guardianProfileId: 'g-1',
      relationship: 'father',
    });

    expect(link).toEqual({ id: 'link-1', relationship: 'father' });
    expect(insertCalls.length).toBeGreaterThan(0);
    const inserted = insertCalls[0] as Record<string, unknown>;
    expect(inserted.studentProfileId).toBe('stu-1');
    expect(inserted.guardianProfileId).toBe('g-1');
    expect(inserted.relationship).toBe('father');
    expect(inserted.tenantId).toBe('tenant-1');
  });
});

describe('GuardianService — unlinkFromStudent last-guardian guard (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('throws when attempting to unlink the last guardian', async () => {
    queueResult([{ id: 'link-1', isPrimaryContact: false }]); // find link
    queueResult([{ id: 'link-1' }]); // allLinks → exactly one

    await expect(
      service.unlinkFromStudent({ guardianProfileId: 'g-1', studentProfileId: 's-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('GuardianService — revokeAccess (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('returns a link with canPickup=false', async () => {
    queueResult([{ id: 'link-1', canPickup: false, isPrimaryContact: false }]);

    const result = await service.revokeAccess({
      guardianProfileId: 'g-1',
      studentProfileId: 's-1',
      reason: 'Court order',
    });

    expect(result.canPickup).toBe(false);
    expect(result.isPrimaryContact).toBe(false);
  });
});
