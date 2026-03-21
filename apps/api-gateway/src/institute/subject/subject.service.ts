import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSubjectInput } from './dto/create-subject.input';
import type { UpdateSubjectInput } from './dto/update-subject.input';
import type { SubjectModel } from './models/subject.model';
import { SubjectRepository } from './repositories/subject.repository';

@Injectable()
export class SubjectService {
  constructor(private readonly repo: SubjectRepository) {}

  async findById(id: string): Promise<SubjectModel> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Subject ${id} not found`);
    return record as unknown as SubjectModel;
  }

  async findAll(): Promise<SubjectModel[]> {
    const records = await this.repo.findAll();
    return records as unknown as SubjectModel[];
  }

  async findByStandard(standardId: string): Promise<SubjectModel[]> {
    const records = await this.repo.findByStandard(standardId);
    return records as unknown as SubjectModel[];
  }

  async create(input: CreateSubjectInput): Promise<SubjectModel> {
    const record = await this.repo.create(input);
    return record as unknown as SubjectModel;
  }

  async update(id: string, input: UpdateSubjectInput): Promise<SubjectModel> {
    const record = await this.repo.update(id, input);
    return record as unknown as SubjectModel;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    return true;
  }

  async assignToStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.assignToStandard(subjectId, standardId);
    return true;
  }

  async removeFromStandard(subjectId: string, standardId: string): Promise<boolean> {
    await this.repo.removeFromStandard(subjectId, standardId);
    return true;
  }

  async assignToSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.assignToSection(subjectId, sectionId);
    return true;
  }

  async removeFromSection(subjectId: string, sectionId: string): Promise<boolean> {
    await this.repo.removeFromSection(subjectId, sectionId);
    return true;
  }
}
