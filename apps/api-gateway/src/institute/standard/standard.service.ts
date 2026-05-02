import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { EVENT_PATTERNS, type EventPattern } from '@roviq/nats-jetstream';
import type { CreateStandardInput } from './dto/create-standard.input';
import type { UpdateStandardInput } from './dto/update-standard.input';
import { StandardRepository } from './repositories/standard.repository';
import type { StandardRecord } from './repositories/types';

@Injectable()
export class StandardService {
  private readonly logger = new Logger(StandardService.name);

  constructor(
    private readonly repo: StandardRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  async findById(id: string): Promise<StandardRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Standard ${id} not found`);
    return record;
  }

  async findByAcademicYear(academicYearId: string): Promise<StandardRecord[]> {
    return this.repo.findByAcademicYear(academicYearId);
  }

  async create(input: CreateStandardInput): Promise<StandardRecord> {
    const record = await this.repo.create(input);

    this.emitEvent(EVENT_PATTERNS.STANDARD.created, {
      standardId: record.id,
      tenantId: record.tenantId,
      name: record.name,
    });

    return record;
  }

  async update(id: string, input: UpdateStandardInput): Promise<StandardRecord> {
    const record = await this.repo.update(id, input);

    this.emitEvent(EVENT_PATTERNS.STANDARD.updated, {
      standardId: record.id,
      tenantId: record.tenantId,
    });

    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);

    this.emitEvent(EVENT_PATTERNS.STANDARD.deleted, { standardId: id });

    return true;
  }

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
