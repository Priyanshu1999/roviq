/**
 * Unit tests for guardian linking logic (ROV-157, PRD §3.2).
 *
 * Tests validation rules for:
 * 1. Unlinking primary contact without replacement → error
 * 2. Unlinking last guardian → error
 * 3. Revoke access → canPickup=false, isPrimaryContact=false, link preserved
 * 4. Delete blocks if only guardian for a student
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue ──────────────────────────────

const resultQueue: unknown[] = [];
let queueIndex = 0;

function queueResult(result: unknown) {
  resultQueue.push(result);
}

function resetQueue() {
  resultQueue.length = 0;
  queueIndex = 0;
}

/** Returns next result from queue. Used by mock tx chain terminal methods. */
function nextResult(): unknown {
  const result = resultQueue[queueIndex] ?? [];
  queueIndex++;
  return result;
}

/**
 * Creates a mock tx where every terminal method (limit, returning, and the
 * chain itself when awaited) returns the next queued result.
 * Intermediate methods (select, from, where, etc.) return the chain for chaining.
 */
function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));

  // Proxy-based chain: any property access returns the chain itself (for chaining),
  // except calling the chain as a function returns a terminal promise.
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        // Terminal methods that resolve with next queued result
        if (prop === 'limit' || prop === 'returning') return terminal;
        // 'then' makes the chain awaitable — resolve with next queued result
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
        // Everything else returns a function that returns the chain (for chaining)
        return vi.fn(() => chain);
      },
    },
  );

  return chain;
}

/** withTenant/withAdmin mock — executes the callback with a mock tx */
async function mockWithContext(_db: unknown, ...args: unknown[]) {
  const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
  const tx = createMockTx();
  return fn(tx);
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

describe('Guardian — Unlink Validation', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('unlinkFromStudent rejects when link not found', async () => {
    queueResult([]); // find link → empty

    await expect(
      service.unlinkFromStudent({ guardianProfileId: 'g1', studentProfileId: 's1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('unlinkFromStudent rejects unlink of primary without replacement', async () => {
    queueResult([{ id: 'link-1', isPrimaryContact: true }]); // find link → primary

    await expect(
      service.unlinkFromStudent({ guardianProfileId: 'g1', studentProfileId: 's1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('unlinkFromStudent rejects unlinking the last guardian', async () => {
    queueResult([{ id: 'link-1', isPrimaryContact: false }]); // find link → not primary
    queueResult([{ id: 'link-1' }]); // allLinks → only 1 link

    await expect(
      service.unlinkFromStudent({ guardianProfileId: 'g1', studentProfileId: 's1' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('Guardian — Revoke Access (Divorce)', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('revokeAccess returns link with canPickup=false', async () => {
    queueResult([{ id: 'link-1', canPickup: false, isPrimaryContact: false }]);

    const result = await service.revokeAccess({
      guardianProfileId: 'g1',
      studentProfileId: 's1',
      reason: 'Court order',
    });

    expect(result.canPickup).toBe(false);
    expect(result.isPrimaryContact).toBe(false);
  });

  it('revokeAccess throws if link not found', async () => {
    queueResult([]); // returning → empty

    await expect(
      service.revokeAccess({ guardianProfileId: 'g1', studentProfileId: 's1' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Guardian — Delete Validation', () => {
  let service: Awaited<ReturnType<typeof createService>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    service = await createService();
  });

  it('delete blocks if guardian is only guardian for a student', async () => {
    queueResult([{ studentProfileId: 's1' }]); // guardian's links
    queueResult([]); // no other guardians for s1

    await expect(service.delete('g1')).rejects.toThrow(BadRequestException);
  });
});
