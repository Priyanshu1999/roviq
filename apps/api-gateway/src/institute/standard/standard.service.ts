import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { CreateStandardInput } from './dto/create-standard.input';
import type { UpdateStandardInput } from './dto/update-standard.input';
import type { StandardModel } from './models/standard.model';
import { StandardRepository } from './repositories/standard.repository';

@Injectable()
export class StandardService {
  private readonly logger = new Logger(StandardService.name);

  constructor(
    private readonly repo: StandardRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  async findById(id: string): Promise<StandardModel> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Standard ${id} not found`);
    return record as unknown as StandardModel;
  }

  async findByAcademicYear(academicYearId: string): Promise<StandardModel[]> {
    const records = await this.repo.findByAcademicYear(academicYearId);
    return records as unknown as StandardModel[];
  }

  async create(input: CreateStandardInput): Promise<StandardModel> {
    const record = await this.repo.create(input);

    this.emitEvent('STANDARD.created', {
      standardId: record.id,
      tenantId: record.tenantId,
      name: record.name,
    });

    return record as unknown as StandardModel;
  }

  async update(id: string, input: UpdateStandardInput): Promise<StandardModel> {
    const record = await this.repo.update(id, input);

    this.emitEvent('STANDARD.updated', {
      standardId: record.id,
      tenantId: record.tenantId,
    });

    return record as unknown as StandardModel;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);

    this.emitEvent('STANDARD.deleted', { standardId: id });

    return true;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
