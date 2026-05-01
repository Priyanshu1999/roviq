/**
 * Unit tests for HolidayService — covers read/list passthroughs, create-time
 * date-range validation, the merged-range rule on update, soft-delete + its
 * emission, and the `onDate` proxy used by the attendance module.
 *
 * Mirrors `attendance.service.spec.ts`: the repository is a manually-typed
 * `vi.fn()` map against the abstract class contract, the NATS client is a
 * stub whose `emit()` returns an observable-like `{ subscribe }`, and the
 * service is constructed via `Object.assign(Object.create(Proto), {...})`
 * so we skip the real constructor (decorator + parameter-property shorthand
 * does not reliably wire private fields under esbuild/Vitest).
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HolidayType } from '@roviq/common-types';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const TENANT_ID = '00000000-0000-7000-a000-000000000001';
const HOLIDAY_ID = '00000000-0000-7000-a000-000000000002';
const FIXED_TS = new Date('2026-04-23T10:00:00Z');

// HolidayService.delete uses `this.tenantId` (request-context getter) when
// emitting the lifecycle event so consumers can route on multi-tenant DLQs
// — vi.mock is hoisted so it resolves before the service module imports.
vi.mock('@roviq/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: TENANT_ID,
    userId: '00000000-0000-7000-a000-000000000099',
    correlationId: 'holiday-service-spec',
  })),
}));

import { HolidayService } from '../holiday.service';
import type { HolidayRepository } from '../repositories/holiday.repository';
import type { HolidayRecord } from '../repositories/types';

function buildHoliday(overrides: Partial<HolidayRecord> = {}): HolidayRecord {
  return {
    id: HOLIDAY_ID,
    tenantId: TENANT_ID,
    name: { en: 'Diwali', hi: 'दिवाली' },
    description: null,
    type: HolidayType.RELIGIOUS,
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    tags: [],
    isPublic: true,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  };
}

/**
 * Minimal EventBusService stand-in — exposes a synchronous `emit` so the
 * service can call `eventBus.emit(pattern, data)` without going through NATS.
 */
function buildEventBusMock() {
  const emit = vi.fn();
  return { emit, eventBus: { emit } };
}

/**
 * Manual repository mock — typed against the abstract class contract so any
 * signature drift in production code surfaces as a type error here.
 */
type MockedRepo = {
  [K in keyof HolidayRepository]: Mock;
};

function buildRepoMock(): MockedRepo {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    onDate: vi.fn(),
  };
}

describe('HolidayService (unit)', () => {
  let service: HolidayService;
  let repo: MockedRepo;
  let eventBusMock: ReturnType<typeof buildEventBusMock>;

  beforeEach(() => {
    repo = buildRepoMock();
    eventBusMock = buildEventBusMock();
    // Build the instance via the prototype so we skip the real constructor.
    // Parameter-property shorthand does not reliably wire private fields
    // under esbuild/Vitest — they end up undefined otherwise.
    service = Object.assign(Object.create(HolidayService.prototype), {
      repo,
      eventBus: eventBusMock.eventBus,
    });
  });

  describe('findById', () => {
    it('returns the record from the repo', async () => {
      const existing = buildHoliday();
      repo.findById.mockResolvedValue(existing);

      const result = await service.findById(HOLIDAY_ID);

      expect(result).toBe(existing);
      expect(repo.findById).toHaveBeenCalledWith(HOLIDAY_ID);
    });

    it('throws NotFoundException when the repo returns null', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(HOLIDAY_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('forwards every filter field untouched to the repo', async () => {
      const filter = {
        type: HolidayType.NATIONAL,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isPublic: true,
      };
      const rows = [buildHoliday()];
      repo.list.mockResolvedValue(rows);

      const result = await service.list(filter);

      expect(result).toBe(rows);
      expect(repo.list).toHaveBeenCalledWith(filter);
    });
  });

  describe('create', () => {
    it('rejects with BadRequestException when endDate precedes startDate', async () => {
      const input = {
        name: { en: 'Broken' },
        type: HolidayType.OTHER,
        startDate: '2026-11-10',
        endDate: '2026-11-09',
        isPublic: true,
      };

      await expect(service.create(input)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(eventBusMock.emit).not.toHaveBeenCalled();
    });

    it('accepts a same-day holiday (startDate === endDate), creates the record and emits HOLIDAY.created', async () => {
      const input = {
        name: { en: 'Diwali', hi: 'दिवाली' },
        description: 'Festival of lights',
        type: HolidayType.RELIGIOUS,
        startDate: '2026-11-07',
        endDate: '2026-11-07',
        tags: ['gazetted'],
        isPublic: true,
      };
      const created = buildHoliday({
        name: input.name,
        description: input.description,
        type: input.type,
        tags: input.tags,
      });
      repo.create.mockResolvedValue(created);

      const result = await service.create(input);

      expect(result).toBe(created);
      expect(repo.create).toHaveBeenCalledWith({
        name: input.name,
        description: 'Festival of lights',
        type: HolidayType.RELIGIOUS,
        startDate: '2026-11-07',
        endDate: '2026-11-07',
        tags: ['gazetted'],
        isPublic: true,
      });
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'HOLIDAY.created',
        expect.objectContaining({
          holidayId: created.id,
          tenantId: TENANT_ID,
          type: HolidayType.RELIGIOUS,
          startDate: '2026-11-07',
          endDate: '2026-11-07',
        }),
      );
    });
  });

  describe('update', () => {
    it('enforces the date rule using the merged existing/patch values and rejects when merged end precedes existing start', async () => {
      // existing.startDate = 2026-11-07 (from buildHoliday). Patch only endDate
      // backward to 2026-11-06 — merged range becomes (2026-11-07, 2026-11-06).
      const existing = buildHoliday({ startDate: '2026-11-07', endDate: '2026-11-07' });
      repo.findById.mockResolvedValue(existing);

      await expect(service.update(HOLIDAY_ID, { endDate: '2026-11-06' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(eventBusMock.emit).not.toHaveBeenCalled();
    });

    it('passes through to the repo and emits HOLIDAY.updated when the merged range is valid', async () => {
      const existing = buildHoliday({ startDate: '2026-11-07', endDate: '2026-11-07' });
      repo.findById.mockResolvedValue(existing);
      const updated = buildHoliday({
        startDate: '2026-11-07',
        endDate: '2026-11-09',
        description: 'extended 3-day festival',
      });
      repo.update.mockResolvedValue(updated);

      const patch = { endDate: '2026-11-09', description: 'extended 3-day festival' };
      const result = await service.update(HOLIDAY_ID, patch);

      expect(result).toBe(updated);
      expect(repo.update).toHaveBeenCalledWith(HOLIDAY_ID, patch);
      expect(eventBusMock.emit).toHaveBeenCalledWith(
        'HOLIDAY.updated',
        expect.objectContaining({
          holidayId: updated.id,
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  describe('delete', () => {
    it('calls repo.softDelete and emits HOLIDAY.deleted', async () => {
      repo.softDelete.mockResolvedValue(undefined);

      const result = await service.delete(HOLIDAY_ID);

      expect(result).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith(HOLIDAY_ID);
      // HL-009: include tenantId on delete events for multi-tenant routing.
      expect(eventBusMock.emit).toHaveBeenCalledWith('HOLIDAY.deleted', {
        holidayId: HOLIDAY_ID,
        tenantId: TENANT_ID,
      });
    });
  });

  describe('onDate', () => {
    it('proxies to repo.onDate with the given date', async () => {
      const hits = [buildHoliday()];
      repo.onDate.mockResolvedValue(hits);

      const result = await service.onDate('2026-11-07');

      expect(result).toBe(hits);
      expect(repo.onDate).toHaveBeenCalledWith({ date: '2026-11-07' });
    });
  });
});
