import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateStaffQualificationInput } from './dto/create-staff-qualification.input';
import { UpdateStaffQualificationInput } from './dto/update-staff-qualification.input';
import { StaffQualificationModel } from './models/staff-qualification.model';
import { StaffQualificationService } from './staff-qualification.service';

/**
 * GraphQL resolver exposing structured staff qualifications. All operations
 * are institute-scoped (tenant isolation via `withTenant`) and gated by CASL
 * abilities on the `Staff` subject — the same subject that governs the
 * parent profile (no dedicated CASL subject for qualifications).
 */
@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => StaffQualificationModel)
export class StaffQualificationResolver {
  constructor(private readonly service: StaffQualificationService) {}

  @Query(() => [StaffQualificationModel], {
    description: 'List qualifications for a given staff profile',
  })
  @CheckAbility('read', 'Staff')
  async listStaffQualifications(
    @Args('staffProfileId', { type: () => ID }) staffProfileId: string,
  ): Promise<StaffQualificationModel[]> {
    return this.service.listForStaff(staffProfileId);
  }

  @Mutation(() => StaffQualificationModel, {
    description: 'Add a qualification record to a staff profile',
  })
  @CheckAbility('update', 'Staff')
  async createStaffQualification(
    @Args('input') input: CreateStaffQualificationInput,
  ): Promise<StaffQualificationModel> {
    return this.service.create(input);
  }

  @Mutation(() => StaffQualificationModel, {
    description: 'Update an existing staff qualification',
  })
  @CheckAbility('update', 'Staff')
  async updateStaffQualification(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStaffQualificationInput,
  ): Promise<StaffQualificationModel> {
    return this.service.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Delete a staff qualification record' })
  @CheckAbility('update', 'Staff')
  async deleteStaffQualification(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.service.delete(id);
  }
}
