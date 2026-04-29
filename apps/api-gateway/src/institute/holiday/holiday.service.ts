import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type HolidayType, isValidDateRange } from '@roviq/common-types';
import { getRequestContext } from '@roviq/request-context';
import { EventBusService } from '../../common/event-bus.service';
import type { CreateHolidayInput } from './dto/create-holiday.input';
import type { UpdateHolidayInput } from './dto/update-holiday.input';
import { HolidayRepository } from './repositories/holiday.repository';
import type { HolidayRecord } from './repositories/types';

@Injectable()
export class HolidayService {
  constructor(
    private readonly repo: HolidayRepository,
    private readonly eventBus: EventBusService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  async findById(id: string): Promise<HolidayRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Holiday ${id} not found`);
    return record;
  }

  async list(filter: {
    type?: HolidayType;
    startDate?: string;
    endDate?: string;
    isPublic?: boolean;
  }): Promise<HolidayRecord[]> {
    return this.repo.list(filter);
  }

  async create(input: CreateHolidayInput): Promise<HolidayRecord> {
    this.assertValidRange(input.startDate, input.endDate);

    const record = await this.repo.create({
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      tags: input.tags ?? [],
      isPublic: input.isPublic,
    });

    this.eventBus.emit('HOLIDAY.created', {
      holidayId: record.id,
      tenantId: record.tenantId,
      type: record.type,
      startDate: record.startDate,
      endDate: record.endDate,
    });

    return record;
  }

  /**
   * HL-008: holiday `update` is intentionally always editable. Institute admins
   * fix typos / extend ranges / merge dates regularly even after attendance
   * has been taken on the affected day. The audit pipeline records every
   * mutation with actor + before/after diff via the audit interceptor, so
   * post-hoc edits are observable, not silent. If a hard lock is ever needed
   * (e.g. "no edit after first attendance session"), encode it here as a
   * domain rule + DB constraint, not as a coincidence.
   */
  async update(id: string, input: UpdateHolidayInput): Promise<HolidayRecord> {
    const existing = await this.findById(id);
    const start = input.startDate ?? existing.startDate;
    const end = input.endDate ?? existing.endDate;
    this.assertValidRange(start, end);

    const record = await this.repo.update(id, input);
    this.eventBus.emit('HOLIDAY.updated', {
      holidayId: record.id,
      tenantId: record.tenantId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    // HL-009-style envelope parity: include tenantId on delete events.
    this.eventBus.emit('HOLIDAY.deleted', { holidayId: id, tenantId: this.tenantId });
    return true;
  }

  /**
   * Returns every holiday that spans `date` (inclusive of both ends). The
   * attendance module uses this at session-open time to refuse creating
   * classes on a declared holiday.
   */
  async onDate(date: string): Promise<HolidayRecord[]> {
    return this.repo.onDate({ date });
  }

  // HL-003: shared `isValidDateRange` lives in @roviq/common-types so leave +
  // holiday + future calendar code agree on the YYYY-MM-DD UTC-midnight rule.
  private assertValidRange(start: string, end: string) {
    if (!isValidDateRange(start, end)) {
      throw new BadRequestException('Holiday end date must not be before the start date.');
    }
  }
}
