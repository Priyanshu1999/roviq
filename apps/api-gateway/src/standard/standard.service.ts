import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateStandardInput } from './dto/create-standard.input';
import type { UpdateStandardInput } from './dto/update-standard.input';
import type { StandardModel } from './models/standard.model';
import { StandardRepository } from './repositories/standard.repository';

@Injectable()
export class StandardService {
  constructor(private readonly repo: StandardRepository) {}

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
    return record as unknown as StandardModel;
  }

  async update(id: string, input: UpdateStandardInput): Promise<StandardModel> {
    const record = await this.repo.update(id, input);
    return record as unknown as StandardModel;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    return true;
  }
}
