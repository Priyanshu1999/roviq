import { Injectable, NotFoundException } from '@nestjs/common';
import { EventBusService } from '@roviq/event-bus';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { getRequestContext } from '@roviq/request-context';
import type { CreateSubjectInput } from './dto/create-subject.input';
import type { UpdateSubjectInput } from './dto/update-subject.input';
import { SubjectRepository } from './repositories/subject.repository';
import type { SubjectRecord } from './repositories/types';

@Injectable()
export class SubjectService {
  constructor(
    private readonly repo: SubjectRepository,
    private readonly eventBus: EventBusService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  async findById(id: string): Promise<SubjectRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Subject ${id} not found`);
    return record;
  }

  async findAll(): Promise<SubjectRecord[]> {
    return this.repo.findAll();
  }

  async findByStandard(standardId: string): Promise<SubjectRecord[]> {
    return this.repo.findByStandard(standardId);
  }

  async create(input: CreateSubjectInput): Promise<SubjectRecord> {
    const record = await this.repo.create(input);
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.created, {
      subjectId: record.id,
      tenantId: record.tenantId,
      name: record.name,
    });
    return record;
  }

  async update(id: string, input: UpdateSubjectInput): Promise<SubjectRecord> {
    const record = await this.repo.update(id, input);
    // SS-001: emit on update so cache/search consumers see metadata changes
    // (the create / delete / assign mutations were already emitting).
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.updated, {
      subjectId: record.id,
      tenantId: record.tenantId,
      name: record.name,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    // HL-009: include tenantId on delete events for consistent multi-tenant
    // routing — consumers shouldn't have to look up the row to find it.
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.deleted, { subjectId: id, tenantId: this.tenantId });
    return true;
  }

  async assignToStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.assignToStandard(subjectId, standardId);
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.assigned_to_standard, {
      subjectId,
      standardId,
      tenantId: this.tenantId,
    });
    return true;
  }

  async removeFromStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.removeFromStandard(subjectId, standardId);
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.removed_from_standard, {
      subjectId,
      standardId,
      tenantId: this.tenantId,
    });
    return true;
  }

  async assignToSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.assignToSection(subjectId, sectionId);
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.assigned_to_section, {
      subjectId,
      sectionId,
      tenantId: this.tenantId,
    });
    return true;
  }

  async removeFromSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.removeFromSection(subjectId, sectionId);
    this.eventBus.emit(EVENT_PATTERNS.SUBJECT.removed_from_section, {
      subjectId,
      sectionId,
      tenantId: this.tenantId,
    });
    return true;
  }
}
