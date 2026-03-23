import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { BusinessException, ErrorCode, getRequestContext } from '@roviq/common-types';
import type { CreateAcademicYearInput } from './dto/create-academic-year.input';
import type { UpdateAcademicYearInput } from './dto/update-academic-year.input';
import type { AcademicYearModel } from './models/academic-year.model';
import { AcademicYearRepository } from './repositories/academic-year.repository';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ['ACTIVE'],
  ACTIVE: ['COMPLETING'],
  COMPLETING: ['ARCHIVED'],
};

@Injectable()
export class AcademicYearService {
  private readonly logger = new Logger(AcademicYearService.name);

  constructor(
    private readonly repo: AcademicYearRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  async findById(id: string): Promise<AcademicYearModel> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Academic year ${id} not found`);
    return record as unknown as AcademicYearModel;
  }

  async findAll(): Promise<AcademicYearModel[]> {
    const records = await this.repo.findAll();
    return records as unknown as AcademicYearModel[];
  }

  async findActive(): Promise<AcademicYearModel | null> {
    const record = await this.repo.findActive();
    return record as unknown as AcademicYearModel | null;
  }

  async create(input: CreateAcademicYearInput): Promise<AcademicYearModel> {
    // Overlap validation — schools only (coaching allows overlapping academic years)
    await this.validateNoOverlap(input.startDate, input.endDate);

    const record = await this.repo.create(input);
    const year = record as unknown as AcademicYearModel;

    this.emitEvent('ACADEMIC_YEAR.created', {
      academicYearId: year.id,
      tenantId: record.tenantId,
      label: year.label,
    });

    return year;
  }

  async update(id: string, input: UpdateAcademicYearInput): Promise<AcademicYearModel> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Academic year ${id} not found`);
    if (existing.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot modify an archived academic year');
    }

    // If dates are changing, re-validate overlap
    const newStart = input.startDate ?? existing.startDate;
    const newEnd = input.endDate ?? existing.endDate;
    if (input.startDate || input.endDate) {
      await this.validateNoOverlap(newStart, newEnd, id);
    }

    const record = await this.repo.update(id, input);
    return record as unknown as AcademicYearModel;
  }

  async activate(id: string): Promise<AcademicYearModel> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`Academic year ${id} not found`);

    const allowed = STATUS_TRANSITIONS[target.status];
    if (!allowed?.includes('ACTIVE')) {
      throw new BadRequestException(`Cannot activate from status ${target.status}`);
    }

    // Find current active year to deactivate
    const currentActive = await this.repo.findActive();
    const record = await this.repo.activate(id, currentActive?.id ?? null);
    const year = record as unknown as AcademicYearModel;

    this.emitEvent('ACADEMIC_YEAR.activated', {
      academicYearId: year.id,
      tenantId: record.tenantId,
      previousYearId: currentActive?.id ?? null,
    });

    return year;
  }

  async archive(id: string): Promise<AcademicYearModel> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Academic year ${id} not found`);

    if (existing.status !== 'COMPLETING') {
      throw new BadRequestException(
        `Cannot archive from status ${existing.status}, must be COMPLETING`,
      );
    }

    const record = await this.repo.updateStatus(id, 'ARCHIVED');
    const year = record as unknown as AcademicYearModel;

    this.emitEvent('ACADEMIC_YEAR.archived', {
      academicYearId: year.id,
      tenantId: record.tenantId,
    });

    return year;
  }

  /**
   * Validate no overlapping date ranges for school-type institutes.
   * Coaching institutes are exempt — 2-year JEE programs can span multiple academic years.
   * Enforced at application level since Drizzle doesn't support EXCLUDE constraints (PRD §5.2).
   */
  private async validateNoOverlap(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    // TODO: Check institute type — skip overlap validation for coaching institutes.
    // Currently validates for all types; will be refined when institute type is available
    // in the request context (PRD §5.2 note: cross-table exclusion constraints aren't
    // directly possible, enforce at application level).
    const overlapping = await this.repo.findOverlapping(startDate, endDate, excludeId);
    if (overlapping.length > 0) {
      throw new BusinessException(
        ErrorCode.ACADEMIC_YEAR_OVERLAP,
        `Date range overlaps with academic year "${overlapping[0].label}"`,
      );
    }
  }
}
