import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACADEMIC_YEAR_STATE_MACHINE,
  BusinessException,
  ErrorCode,
  type InstituteType,
} from '@roviq/common-types';
import { DRIZZLE_DB, type DrizzleDB, institutesLive, mkAdminCtx, withAdmin } from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { eq } from 'drizzle-orm';
import { EventBusService } from '../common/event-bus.service';
import type { CreateAcademicYearInput } from './dto/create-academic-year.input';
import type { UpdateAcademicYearInput } from './dto/update-academic-year.input';
import { AcademicYearRepository } from './repositories/academic-year.repository';
import type { AcademicYearRecord } from './repositories/types';

/**
 * CU-004: institute types for which overlap validation is enforced. Coaching
 * institutes routinely run multi-year programs (2-year JEE, 3-year NEET) that
 * span overlapping academic years, so they're exempt. Libraries don't issue
 * academic years today but if they ever do they default to "no overlap"
 * (the safer rule).
 */
const OVERLAP_VALIDATED_INSTITUTE_TYPES: ReadonlySet<InstituteType> = new Set([
  'SCHOOL',
  'LIBRARY',
]);

@Injectable()
export class AcademicYearService {
  constructor(
    private readonly repo: AcademicYearRepository,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly eventBus: EventBusService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
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
    await this.validateNoOverlap(input.startDate, input.endDate);

    const record = await this.repo.create(input);

    this.eventBus.emit('ACADEMIC_YEAR.created', {
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

    const record = await this.repo.update(id, input);

    // CU-003: emit on update so downstream caches and integrators see the
    // common "edit dates / label" path the same way they see create / activate
    // / archive / delete.
    this.eventBus.emit('ACADEMIC_YEAR.updated', {
      academicYearId: record.id,
      tenantId: record.tenantId,
      label: record.label,
    });

    return record;
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

    ACADEMIC_YEAR_STATE_MACHINE.assertTransition(target.status, 'ACTIVE');

    // Find current active year to deactivate
    const currentActive = await this.repo.findActive();
    const record = await this.repo.activate(id, currentActive?.id ?? null);

    this.eventBus.emit('ACADEMIC_YEAR.activated', {
      academicYearId: record.id,
      tenantId: record.tenantId,
      previousYearId: currentActive?.id ?? null,
    });

    return record;
  }

  async archive(id: string): Promise<AcademicYearRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Academic year ${id} not found`);

    ACADEMIC_YEAR_STATE_MACHINE.assertTransition(existing.status, 'ARCHIVED');

    const record = await this.repo.updateStatus(id, 'ARCHIVED');

    this.eventBus.emit('ACADEMIC_YEAR.archived', {
      academicYearId: record.id,
      tenantId: record.tenantId,
    });

    return record;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.tenantId;
    await this.repo.softDelete(id);
    // HL-009-style envelope parity: include tenantId on delete events for
    // multi-tenant routing on consumer DLQs.
    this.eventBus.emit('ACADEMIC_YEAR.deleted', { academicYearId: id, tenantId });
    return true;
  }

  /**
   * CU-004: validate no overlapping date ranges, but only for institute types
   * that disallow overlap (SCHOOL, LIBRARY). Coaching institutes can run
   * multi-year programs that legitimately span overlapping academic years.
   *
   * `institutes` is a platform-level table (no RLS for app role on its own
   * tenant_id column), so the type lookup uses `withAdmin` — read-only,
   * scoped to the current tenant id.
   */
  private async validateNoOverlap(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    const tenantId = this.tenantId;
    const instituteType = await this.lookupInstituteType(tenantId);
    if (!OVERLAP_VALIDATED_INSTITUTE_TYPES.has(instituteType)) {
      return;
    }

    const overlapping = await this.repo.findOverlapping(startDate, endDate, excludeId);
    if (overlapping.length > 0) {
      throw new BusinessException(
        ErrorCode.ACADEMIC_YEAR_OVERLAP,
        `Date range overlaps with academic year "${overlapping[0].label}"`,
      );
    }
  }

  private async lookupInstituteType(tenantId: string): Promise<InstituteType> {
    const rows = await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      return tx
        .select({ type: institutesLive.type })
        .from(institutesLive)
        .where(eq(institutesLive.id, tenantId))
        .limit(1);
    });
    if (rows.length === 0) {
      throw new NotFoundException('Institute not found for current tenant context');
    }
    return rows[0].type as InstituteType;
  }
}
