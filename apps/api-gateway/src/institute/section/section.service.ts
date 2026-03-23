import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { CreateSectionInput } from './dto/create-section.input';
import type { UpdateSectionInput } from './dto/update-section.input';
import type { SectionModel } from './models/section.model';
import { SectionRepository } from './repositories/section.repository';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);

  constructor(
    private readonly repo: SectionRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  async findById(id: string): Promise<SectionModel> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Section ${id} not found`);
    return record as unknown as SectionModel;
  }

  async findByStandard(standardId: string): Promise<SectionModel[]> {
    const records = await this.repo.findByStandard(standardId);
    return records as unknown as SectionModel[];
  }

  async create(input: CreateSectionInput): Promise<SectionModel> {
    const record = await this.repo.create(input);

    this.emitEvent('SECTION.created', {
      sectionId: record.id,
      tenantId: record.tenantId,
      standardId: record.standardId,
    });

    return record as unknown as SectionModel;
  }

  async update(id: string, input: UpdateSectionInput): Promise<SectionModel> {
    const record = await this.repo.update(id, input);

    this.emitEvent('SECTION.updated', {
      sectionId: record.id,
      tenantId: record.tenantId,
    });

    return record as unknown as SectionModel;
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
