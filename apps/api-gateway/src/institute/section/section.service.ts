import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { CreateSectionInput } from './dto/create-section.input';
import type { UpdateSectionInput } from './dto/update-section.input';
import { SectionRepository } from './repositories/section.repository';
import type { SectionRecord } from './repositories/types';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);

  constructor(
    private readonly repo: SectionRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
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
    // TODO: Validate stream is required when parent standard has streamApplicable=true (STREAM_REQUIRED error)
    const record = await this.repo.create(input);

    this.emitEvent('SECTION.created', {
      sectionId: record.id,
      tenantId: record.tenantId,
      standardId: record.standardId,
    });

    return record;
  }

  async update(id: string, input: UpdateSectionInput): Promise<SectionRecord> {
    const record = await this.repo.update(id, input);

    this.emitEvent('SECTION.updated', {
      sectionId: record.id,
      tenantId: record.tenantId,
    });

    return record;
  }

  async assignClassTeacher(sectionId: string, classTeacherId: string): Promise<SectionRecord> {
    const record = await this.repo.update(sectionId, { classTeacherId });
    this.emitEvent('SECTION.teacher_assigned', {
      sectionId: record.id,
      tenantId: record.tenantId,
      classTeacherId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);

    this.emitEvent('SECTION.deleted', { sectionId: id });

    return true;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
