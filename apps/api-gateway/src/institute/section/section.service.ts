import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessException, ErrorCode } from '@roviq/common-types';
import { i18nDisplay } from '@roviq/database';
import { EventBusService } from '@roviq/event-bus';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { StandardRepository } from '../standard/repositories/standard.repository';
import type { CreateSectionInput } from './dto/create-section.input';
import type { UpdateSectionInput } from './dto/update-section.input';
import { SectionRepository } from './repositories/section.repository';
import type { SectionRecord } from './repositories/types';

@Injectable()
export class SectionService {
  constructor(
    private readonly repo: SectionRepository,
    private readonly standardRepo: StandardRepository,
    private readonly eventBus: EventBusService,
  ) {}

  async findById(id: string): Promise<SectionRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Section ${id} not found`);
    return record;
  }

  async findByStandard(standardId: string): Promise<SectionRecord[]> {
    return this.repo.findByStandard(standardId);
  }

  async create(input: CreateSectionInput): Promise<SectionRecord> {
    // SS-003: when the parent standard has streamApplicable=true (typically
    // higher-secondary classes — Science / Commerce / Arts), every section
    // under it MUST declare a stream. Validating in service rather than DB so
    // the error code reaches GraphQL extensions cleanly.
    const parent = await this.standardRepo.findById(input.standardId);
    if (!parent) {
      throw new NotFoundException(`Standard ${input.standardId} not found`);
    }
    if (parent.streamApplicable && !input.stream) {
      throw new BusinessException(
        ErrorCode.STREAM_REQUIRED,
        `Sections under "${i18nDisplay(parent.name)}" must declare a stream (Science / Commerce / Arts).`,
      );
    }

    const record = await this.repo.create(input);

    this.eventBus.emit(EVENT_PATTERNS.SECTION.created, {
      sectionId: record.id,
      tenantId: record.tenantId,
      standardId: record.standardId,
    });

    return record;
  }

  async update(id: string, input: UpdateSectionInput): Promise<SectionRecord> {
    const record = await this.repo.update(id, input);

    this.eventBus.emit(EVENT_PATTERNS.SECTION.updated, {
      sectionId: record.id,
      tenantId: record.tenantId,
    });

    return record;
  }

  async assignClassTeacher(sectionId: string, classTeacherId: string): Promise<SectionRecord> {
    const record = await this.repo.update(sectionId, { classTeacherId });
    this.eventBus.emit(EVENT_PATTERNS.SECTION.teacher_assigned, {
      sectionId: record.id,
      tenantId: record.tenantId,
      classTeacherId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    await this.repo.softDelete(id);
    // HL-009-style envelope parity: include tenantId on delete events.
    this.eventBus.emit(EVENT_PATTERNS.SECTION.deleted, {
      sectionId: id,
      tenantId: existing.tenantId,
    });
    return true;
  }
}
