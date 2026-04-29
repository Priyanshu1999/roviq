import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { HolidayType } from '@roviq/common-types';
import type { CreateHolidayInput } from './dto/create-holiday.input';
import type { UpdateHolidayInput } from './dto/update-holiday.input';
import { HolidayRepository } from './repositories/holiday.repository';
import type { HolidayRecord } from './repositories/types';

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);

  constructor(
    private readonly repo: HolidayRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

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

    this.emitEvent('HOLIDAY.created', {
      holidayId: record.id,
      tenantId: record.tenantId,
      type: record.type,
      startDate: record.startDate,
      endDate: record.endDate,
    });

    return record;
  }

  async update(id: string, input: UpdateHolidayInput): Promise<HolidayRecord> {
    const existing = await this.findById(id);
    const start = input.startDate ?? existing.startDate;
    const end = input.endDate ?? existing.endDate;
    this.assertValidRange(start, end);

    const record = await this.repo.update(id, input);
    this.emitEvent('HOLIDAY.updated', {
      holidayId: record.id,
      tenantId: record.tenantId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    this.emitEvent('HOLIDAY.deleted', { holidayId: id });
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

  private assertValidRange(start: string, end: string) {
    if (Date.parse(`${end}T00:00:00Z`) < Date.parse(`${start}T00:00:00Z`)) {
      throw new BadRequestException('Holiday end date must not be before the start date.');
    }
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
