/**
 * Unit tests for LeaveService — covers read/list passthroughs, the apply-time
 * date-range + supporting-document rules, the PENDING-only edit gate, the
 * three status transitions (approve / reject / cancel) and their differing
 * NATS emission sets, soft-delete, and the attendance-side `approvedOnDate`
 * short-circuit.
 *
 * Mirrors `attendance.service.spec.ts`: the repository is a manually-typed
 * `vi.fn()` map against the abstract class contract, the NATS client is a
 * stub whose `emit()` returns an observable-like `{ subscribe }`, and the
 * service is constructed via `Object.assign(Object.create(Proto), {...})`
 * so we skip the real constructor (decorator + parameter-property shorthand
 * does not reliably wire private fields under esbuild/Vitest).
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveStatus, LeaveType } from '@roviq/common-types';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { LeaveService } from '../leave.service';
import type { LeaveRepository } from '../repositories/leave.repository';
import type { LeaveRecord } from '../repositories/types';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const LEAVE_ID = '00000000-0000-4000-a000-000000000002';
const USER_ID = '00000000-0000-4000-a000-000000000003';
const APPROVER_ID = '00000000-0000-4000-a000-000000000004';
const FIXED_TS = new Date('2026-04-23T10:00:00Z');

function buildLeave(overrides: Partial<LeaveRecord> = {}): LeaveRecord {
  return {
    id: LEAVE_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    type: LeaveType.CASUAL,
    reason: 'family function',
    status: LeaveStatus.PENDING,
    fileUrls: [],
    decidedBy: null,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  };
}

/**
 * Minimal ClientProxy stand-in — `emit()` must return something `.subscribe`-able
 * because the service attaches an error handler on every emission.
 */
function buildNatsMock() {
  const subscribe = vi.fn();
  const emit = vi.fn((_pattern: string, _data: Record<string, unknown>) => ({ subscribe }));
  const client = { emit };
  return { client, emit, subscribe };
}

/**
 * Manual repository mock — typed against the abstract class contract so any
 * signature drift in production code surfaces as a type error here.
 */
type MockedRepo = {
  [K in keyof LeaveRepository]: Mock;
};

function buildRepoMock(): MockedRepo {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    softDelete: vi.fn(),
    approvedOnDate: vi.fn(),
  };
}

describe('LeaveService (unit)', () => {
  let service: LeaveService;
  let repo: MockedRepo;
  let nats: ReturnType<typeof buildNatsMock>;

  beforeEach(() => {
    repo = buildRepoMock();
    nats = buildNatsMock();
    // Build the instance via the prototype so we skip the real constructor.
    // That constructor uses TS parameter-property shorthand combined with
    // `@Inject('JETSTREAM_CLIENT')`, which esbuild does not fully wire under
    // Vitest — the private `natsClient` field ends up undefined.
    service = Object.assign(Object.create(LeaveService.prototype), {
      repo,
      natsClient: nats.client,
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
      },
    });
  });

  describe('findById', () => {
    it('returns the record from the repo', async () => {
      const existing = buildLeave();
      repo.findById.mockResolvedValue(existing);

      const result = await service.findById(LEAVE_ID);

      expect(result).toBe(existing);
      expect(repo.findById).toHaveBeenCalledWith(LEAVE_ID);
    });

    it('throws NotFoundException when the repo returns null', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(LEAVE_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('forwards every filter field untouched to the repo', async () => {
      const filter = {
        userId: USER_ID,
        status: LeaveStatus.APPROVED,
        type: LeaveType.MEDICAL,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      };
      const rows = [buildLeave()];
      repo.list.mockResolvedValue(rows);

      const result = await service.list(filter);

      expect(result).toBe(rows);
      expect(repo.list).toHaveBeenCalledWith(filter);
    });
  });

  describe('apply', () => {
    it('rejects with BadRequestException when endDate precedes startDate', async () => {
      const input = {
        userId: USER_ID,
        startDate: '2026-05-10',
        endDate: '2026-05-09',
        type: LeaveType.CASUAL,
        reason: 'typo',
      };

      // The service wraps `assertValidRange` — message matches production.
      await expect(service.apply(input)).rejects.toThrow(
        'Leave end date must not be before the start date.',
      );
      await expect(service.apply(input)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(nats.emit).not.toHaveBeenCalled();
    });

    it('rejects with BadRequestException when the range exceeds 2 days and no files are attached', async () => {
      const input = {
        userId: USER_ID,
        startDate: '2026-05-01',
        // 2026-05-01 → 2026-05-05 = 4-day diff (> MAX_UNDOCUMENTED_DAYS)
        endDate: '2026-05-05',
        type: LeaveType.MEDICAL,
        reason: 'flu',
        fileUrls: [],
      };

      await expect(service.apply(input)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(nats.emit).not.toHaveBeenCalled();
    });

    it('accepts a 4-day leave when fileUrls is non-empty, creates the record and emits LEAVE.applied', async () => {
      const input = {
        userId: USER_ID,
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        type: LeaveType.MEDICAL,
        reason: 'flu with doctor note',
        fileUrls: ['https://files.example.com/med-cert.pdf'],
      };
      const created = buildLeave({
        startDate: input.startDate,
        endDate: input.endDate,
        type: input.type,
        reason: input.reason,
        fileUrls: input.fileUrls,
      });
      repo.create.mockResolvedValue(created);

      const result = await service.apply(input);

      expect(result).toBe(created);
      expect(repo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        type: LeaveType.MEDICAL,
        reason: 'flu with doctor note',
        fileUrls: ['https://files.example.com/med-cert.pdf'],
      });
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.applied',
        expect.objectContaining({
          leaveId: created.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          type: LeaveType.MEDICAL,
        }),
      );
    });

    it('accepts a 2-day leave with no supporting files (under the undocumented-days threshold)', async () => {
      const input = {
        userId: USER_ID,
        startDate: '2026-05-01',
        // 2026-05-01 → 2026-05-03 = 2-day diff (== MAX_UNDOCUMENTED_DAYS)
        endDate: '2026-05-03',
        type: LeaveType.CASUAL,
        reason: 'short trip',
      };
      const created = buildLeave({
        startDate: input.startDate,
        endDate: input.endDate,
        fileUrls: [],
      });
      repo.create.mockResolvedValue(created);

      const result = await service.apply(input);

      expect(result).toBe(created);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          fileUrls: [],
        }),
      );
      expect(nats.emit).toHaveBeenCalledWith('LEAVE.applied', expect.anything());
    });
  });

  describe('update', () => {
    it('rejects with BadRequestException when the existing leave is already APPROVED', async () => {
      const existing = buildLeave({ status: LeaveStatus.APPROVED });
      repo.findById.mockResolvedValue(existing);

      await expect(service.update(LEAVE_ID, { reason: 'changed my mind' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(nats.emit).not.toHaveBeenCalled();
    });

    it('passes through to the repo when existing status is PENDING and emits LEAVE.updated', async () => {
      const existing = buildLeave({ status: LeaveStatus.PENDING });
      repo.findById.mockResolvedValue(existing);
      const updated = buildLeave({ reason: 'updated reason' });
      repo.update.mockResolvedValue(updated);

      const patch = { reason: 'updated reason' };
      const result = await service.update(LEAVE_ID, patch);

      expect(result).toBe(updated);
      expect(repo.update).toHaveBeenCalledWith(LEAVE_ID, patch);
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.updated',
        expect.objectContaining({
          leaveId: updated.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
        }),
      );
    });
  });

  describe('approve', () => {
    it("delegates to repo.setStatus('APPROVED', ...) and emits LEAVE.approved + NOTIFICATION.leave.decided", async () => {
      const approved = buildLeave({ status: LeaveStatus.APPROVED, decidedBy: APPROVER_ID });
      repo.setStatus.mockResolvedValue(approved);

      const result = await service.approve(LEAVE_ID, APPROVER_ID);

      expect(result).toBe(approved);
      expect(repo.setStatus).toHaveBeenCalledWith(LEAVE_ID, 'APPROVED', APPROVER_ID);
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.approved',
        expect.objectContaining({
          leaveId: approved.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
          approverMembershipId: APPROVER_ID,
        }),
      );
      expect(nats.emit).toHaveBeenCalledWith(
        'NOTIFICATION.leave.decided',
        expect.objectContaining({
          leaveId: approved.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
          status: 'APPROVED',
        }),
      );
    });
  });

  describe('reject', () => {
    it("delegates to repo.setStatus('REJECTED', ...) and emits LEAVE.rejected + NOTIFICATION.leave.decided", async () => {
      const rejected = buildLeave({ status: LeaveStatus.REJECTED, decidedBy: APPROVER_ID });
      repo.setStatus.mockResolvedValue(rejected);

      const result = await service.reject(LEAVE_ID, APPROVER_ID);

      expect(result).toBe(rejected);
      expect(repo.setStatus).toHaveBeenCalledWith(LEAVE_ID, 'REJECTED', APPROVER_ID);
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.rejected',
        expect.objectContaining({
          leaveId: rejected.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
          approverMembershipId: APPROVER_ID,
        }),
      );
      expect(nats.emit).toHaveBeenCalledWith(
        'NOTIFICATION.leave.decided',
        expect.objectContaining({
          leaveId: rejected.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
          status: 'REJECTED',
        }),
      );
    });
  });

  describe('cancel', () => {
    it("delegates to repo.setStatus('CANCELLED', ...), emits LEAVE.cancelled, and does NOT emit the notification event", async () => {
      const cancelled = buildLeave({ status: LeaveStatus.CANCELLED, decidedBy: APPROVER_ID });
      repo.setStatus.mockResolvedValue(cancelled);

      const result = await service.cancel(LEAVE_ID, APPROVER_ID);

      expect(result).toBe(cancelled);
      expect(repo.setStatus).toHaveBeenCalledWith(LEAVE_ID, 'CANCELLED', APPROVER_ID);
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.cancelled',
        expect.objectContaining({
          leaveId: cancelled.id,
          tenantId: TENANT_ID,
          userId: USER_ID,
        }),
      );
      const patterns = nats.emit.mock.calls.map((c) => c[0]);
      expect(patterns).not.toContain('NOTIFICATION.leave.decided');
    });
  });

  describe('delete', () => {
    it('calls repo.softDelete and emits LEAVE.deleted', async () => {
      repo.softDelete.mockResolvedValue(undefined);

      const result = await service.delete(LEAVE_ID);

      expect(result).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith(LEAVE_ID);
      expect(nats.emit).toHaveBeenCalledWith(
        'LEAVE.deleted',
        expect.objectContaining({ leaveId: LEAVE_ID }),
      );
    });
  });

  describe('approvedOnDate', () => {
    it('short-circuits to [] on empty userIds without hitting the repo', async () => {
      const result = await service.approvedOnDate('2026-05-01', []);

      expect(result).toEqual([]);
      expect(repo.approvedOnDate).not.toHaveBeenCalled();
    });

    it('forwards non-empty userIds + date to the repo', async () => {
      const userIds = [USER_ID];
      const hits = [USER_ID];
      repo.approvedOnDate.mockResolvedValue(hits);

      const result = await service.approvedOnDate('2026-05-01', userIds);

      expect(result).toBe(hits);
      expect(repo.approvedOnDate).toHaveBeenCalledWith({
        date: '2026-05-01',
        userIds,
      });
    });
  });
});
