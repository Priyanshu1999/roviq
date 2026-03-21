import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSectionInput } from './dto/create-section.input';
import type { UpdateSectionInput } from './dto/update-section.input';
import type { SectionModel } from './models/section.model';
import { SectionRepository } from './repositories/section.repository';

@Injectable()
export class SectionService {
  constructor(private readonly repo: SectionRepository) {}

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
    return record as unknown as SectionModel;
  }

  async update(id: string, input: UpdateSectionInput): Promise<SectionModel> {
    const record = await this.repo.update(id, input);
    return record as unknown as SectionModel;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    return true;
  }
}
