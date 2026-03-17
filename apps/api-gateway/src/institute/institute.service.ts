import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateInstituteInput } from './dto/create-institute.input';
import type { UpdateInstituteInfoInput } from './dto/update-institute-info.input';
import type { InstituteModel } from './models/institute.model';
import { InstituteRepository } from './repositories/institute.repository';

// Valid status transitions: from → [allowed targets]
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  INACTIVE: ['ACTIVE'],
  SUSPENDED: ['ACTIVE'],
  // REJECTED is terminal — no transitions out
};

@Injectable()
export class InstituteService {
  constructor(private readonly instituteRepo: InstituteRepository) {}

  async findById(id: string): Promise<InstituteModel> {
    const record = await this.instituteRepo.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record as unknown as InstituteModel;
  }

  async create(input: CreateInstituteInput): Promise<InstituteModel> {
    const record = await this.instituteRepo.create(input);
    return record as unknown as InstituteModel;
  }

  async updateInfo(id: string, input: UpdateInstituteInfoInput): Promise<InstituteModel> {
    const record = await this.instituteRepo.updateInfo(id, input);
    return record as unknown as InstituteModel;
  }

  async activate(id: string): Promise<InstituteModel> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'ACTIVE');

    if (institute.setupStatus !== 'COMPLETED') {
      throw new BadRequestException(
        `Cannot activate institute: setup_status is ${institute.setupStatus}, must be COMPLETED`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'ACTIVE');
    return record as unknown as InstituteModel;
  }

  async deactivate(id: string): Promise<InstituteModel> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'INACTIVE');
    const record = await this.instituteRepo.updateStatus(id, 'INACTIVE');
    return record as unknown as InstituteModel;
  }

  async suspend(id: string): Promise<InstituteModel> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'SUSPENDED');
    const record = await this.instituteRepo.updateStatus(id, 'SUSPENDED');
    return record as unknown as InstituteModel;
  }

  async reject(id: string): Promise<InstituteModel> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'REJECTED');
    const record = await this.instituteRepo.updateStatus(id, 'REJECTED');
    return record as unknown as InstituteModel;
  }

  async delete(id: string): Promise<boolean> {
    await this.requireInstitute(id);
    await this.instituteRepo.softDelete(id);
    return true;
  }

  async restore(id: string): Promise<InstituteModel> {
    const record = await this.instituteRepo.restore(id);
    return record as unknown as InstituteModel;
  }

  private async requireInstitute(id: string) {
    const record = await this.instituteRepo.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record;
  }

  private validateTransition(currentStatus: string, targetStatus: string): void {
    const allowed = STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    }
  }
}
