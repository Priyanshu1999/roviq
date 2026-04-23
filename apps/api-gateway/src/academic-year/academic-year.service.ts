import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { BusinessException, ErrorCode } from '@roviq/common-types';
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

    this.validateLabelMatchesDates(input.label, input.startDate, input.endDate);

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

    // If label, startDate, or endDate is changing, re-validate label-to-date consistency
    if (input.label !== undefined || input.startDate !== undefined || input.endDate !== undefined) {
      const newLabel = input.label ?? existing.label;
      this.validateLabelMatchesDates(newLabel, newStart, newEnd);
    }

    return this.repo.update(id, input);
  }

  /**
   * Cross-field validation: the YYYY-YY label must match the start/end year of the date range.
   * Leading 4 digits = startDate UTC year; trailing 2 digits = endDate UTC year mod 100.
   * Regex shape is enforced by the DTO; this only checks numeric consistency.
   */
  private validateLabelMatchesDates(label: string, startDate: string, endDate: string): void {
    const labelStartYear = Number.parseInt(label.slice(0, 4), 10);
    const labelEndYear = Number.parseInt(label.slice(5, 7), 10);
    const startYear = new Date(startDate).getUTCFullYear();
    const endYearMod = new Date(endDate).getUTCFullYear() % 100;

    if (labelStartYear !== startYear || labelEndYear !== endYearMod) {
      throw new BusinessException(
        ErrorCode.LABEL_DATE_MISMATCH,
        `label "${label}" does not match date range: expected leading year ${startYear} and trailing year ${endYearMod
          .toString()
          .padStart(2, '0')}`,
      );
    }
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
