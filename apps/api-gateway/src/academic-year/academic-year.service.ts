import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { BusinessException, ErrorCode, getRequestContext } from '@roviq/common-types';
import type { CreateAcademicYearInput } from './dto/create-academic-year.input';
import type { UpdateAcademicYearInput } from './dto/update-academic-year.input';
import { AcademicYearRepository } from './repositories/academic-year.repository';
import type { AcademicYearRecord } from './repositories/types';

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

  async findById(id: string): Promise<AcademicYearRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Academic year ${id} not found`);
    return record;
  }

  async findAll(): Promise<AcademicYearRecord[]> {
    return this.repo.findAll();
  }

  async findActive(): Promise<AcademicYearRecord | null> {
    return this.repo.findActive();
  }

  async create(input: CreateAcademicYearInput): Promise<AcademicYearRecord> {
    if (input.startDate >= input.endDate) {
      throw new BusinessException(
        ErrorCode.INVALID_DATE_RANGE,
        'Start date must be before end date',
      );
    }

    // Overlap validation — schools only (coaching allows overlapping academic years)
    await this.validateNoOverlap(input.startDate, input.endDate);

    const record = await this.repo.create(input);

    this.emitEvent('ACADEMIC_YEAR.created', {
      academicYearId: record.id,
      tenantId: record.tenantId,
      label: record.label,
    });

    return record;
  }

  async update(id: string, input: UpdateAcademicYearInput): Promise<AcademicYearRecord> {
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

    return this.repo.update(id, input);
  }

  async activate(id: string): Promise<AcademicYearRecord> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`Academic year ${id} not found`);

    if (target.isActive) {
      throw new BusinessException(
        ErrorCode.YEAR_ALREADY_ACTIVE,
        'This academic year is already active',
      );
    }

    const allowed = STATUS_TRANSITIONS[target.status];
    if (!allowed?.includes('ACTIVE')) {
      throw new BadRequestException(`Cannot activate from status ${target.status}`);
    }

    // Find current active year to deactivate
    const currentActive = await this.repo.findActive();
    const record = await this.repo.activate(id, currentActive?.id ?? null);

    this.emitEvent('ACADEMIC_YEAR.activated', {
      academicYearId: record.id,
      tenantId: record.tenantId,
      previousYearId: currentActive?.id ?? null,
    });

    return record;
  }

  async archive(id: string): Promise<AcademicYearRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Academic year ${id} not found`);

    if (existing.status !== 'COMPLETING') {
      throw new BadRequestException(
        `Cannot archive from status ${existing.status}, must be COMPLETING`,
      );
    }

    const record = await this.repo.updateStatus(id, 'ARCHIVED');

    this.emitEvent('ACADEMIC_YEAR.archived', {
      academicYearId: record.id,
      tenantId: record.tenantId,
    });

    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    this.emitEvent('ACADEMIC_YEAR.deleted', { academicYearId: id });
    return true;
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
