import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateStaffInput } from './dto/create-staff.input';
import { ListStaffFilterInput } from './dto/list-staff-filter.input';
import { UpdateStaffInput } from './dto/update-staff.input';
import { StaffModel, StaffStatistics } from './models/staff.model';
import { StaffService } from './staff.service';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => StaffModel)
export class StaffResolver {
  constructor(private readonly staffService: StaffService) {}

  @Query(() => [StaffModel], { description: 'List staff with optional filters' })
  @CheckAbility('read', 'Staff')
  async listStaff(
    @Args('filter', { nullable: true }) filter?: ListStaffFilterInput,
  ): Promise<StaffModel[]> {
    return this.staffService.list(filter ?? {}) as Promise<StaffModel[]>;
  }

  @Query(() => StaffModel, { description: 'Get a single staff member by ID' })
  @CheckAbility('read', 'Staff')
  async getStaffMember(@Args('id', { type: () => ID }) id: string): Promise<StaffModel> {
    return this.staffService.findById(id) as Promise<StaffModel>;
  }

  @Query(() => StaffStatistics, { description: 'Staff statistics aggregated by department' })
  @CheckAbility('read', 'Staff')
  async staffStatistics(): Promise<StaffStatistics> {
    return this.staffService.statistics() as Promise<StaffStatistics>;
  }

  @Mutation(() => StaffModel, { description: 'Create a new staff member' })
  @CheckAbility('create', 'Staff')
  async createStaffMember(@Args('input') input: CreateStaffInput): Promise<StaffModel> {
    return this.staffService.create(input) as Promise<StaffModel>;
  }

  @Mutation(() => StaffModel, { description: 'Update staff member with optimistic concurrency' })
  @CheckAbility('update', 'Staff')
  async updateStaffMember(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStaffInput,
  ): Promise<StaffModel> {
    return this.staffService.update(id, input) as Promise<StaffModel>;
  }

  @Mutation(() => Boolean, { description: 'Soft-delete staff member, sets date_of_leaving' })
  @CheckAbility('delete', 'Staff')
  async deleteStaffMember(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.staffService.delete(id);
  }
}
