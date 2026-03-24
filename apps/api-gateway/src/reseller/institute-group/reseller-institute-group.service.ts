import { Injectable } from '@nestjs/common';
import type { CreateInstituteGroupInput } from '../../institute-group/dto/create-institute-group.input';
import { InstituteGroupService } from '../../institute-group/institute-group.service';

@Injectable()
export class ResellerInstituteGroupService {
  constructor(private readonly groupService: InstituteGroupService) {}

  async create(input: CreateInstituteGroupInput) {
    return this.groupService.create(input);
  }

  async list() {
    // RLS via roviq_reseller policy scopes to groups containing their institutes
    return this.groupService.search({});
  }
}
