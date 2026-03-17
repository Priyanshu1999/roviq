import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CheckAbility, GqlAuthGuard } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInstituteInput } from './dto/create-institute.input';
import { UpdateInstituteInfoInput } from './dto/update-institute-info.input';
import { InstituteService } from './institute.service';
import { InstituteModel } from './models/institute.model';

@Resolver(() => InstituteModel)
export class InstituteResolver {
  constructor(private readonly instituteService: InstituteService) {}

  @Query(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'Institute')
  async institute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.findById(id);
  }

  @Query(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'Institute')
  async myInstitute(@CurrentUser() user: AuthUser): Promise<InstituteModel> {
    return this.instituteService.findById(user.tenantId);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('create', 'Institute')
  async createInstitute(@Args('input') input: CreateInstituteInput): Promise<InstituteModel> {
    return this.instituteService.create(input);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Institute')
  async updateInstituteInfo(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateInstituteInfoInput,
  ): Promise<InstituteModel> {
    return this.instituteService.updateInfo(id, input);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Institute')
  async activateInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.activate(id);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Institute')
  async deactivateInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.deactivate(id);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Institute')
  async suspendInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.suspend(id);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Institute')
  async rejectInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.reject(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('delete', 'Institute')
  async deleteInstitute(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.instituteService.delete(id);
  }

  @Mutation(() => InstituteModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('manage', 'Institute')
  async restoreInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.restore(id);
  }
}
