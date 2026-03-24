import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { CreateSubjectInput } from './dto/create-subject.input';
import type { UpdateSubjectInput } from './dto/update-subject.input';
import { SubjectRepository } from './repositories/subject.repository';
import type { SubjectRecord } from './repositories/types';

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);

  constructor(
    private readonly repo: SubjectRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

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

    this.emitEvent('SUBJECT.created', {
      subjectId: record.id,
      tenantId: record.tenantId,
      name: record.name,
    });

    return record;
  }

  async update(id: string, input: UpdateSubjectInput): Promise<SubjectRecord> {
    const record = await this.repo.update(id, input);
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);

    this.emitEvent('SUBJECT.deleted', { subjectId: id });

    return true;
  }

  async assignToStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.assignToStandard(subjectId, standardId);

    this.emitEvent('SUBJECT.assigned_to_standard', { subjectId, standardId });

    return true;
  }

  async removeFromStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.removeFromStandard(subjectId, standardId);

    this.emitEvent('SUBJECT.removed_from_standard', { subjectId, standardId });

    return true;
  }

  async assignToSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.assignToSection(subjectId, sectionId);

    this.emitEvent('SUBJECT.assigned_to_section', { subjectId, sectionId });

    return true;
  }

  async removeFromSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.removeFromSection(subjectId, sectionId);

    this.emitEvent('SUBJECT.removed_from_section', { subjectId, sectionId });

    return true;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
