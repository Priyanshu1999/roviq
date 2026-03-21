import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import { CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { CreateInstituteInput } from './dto/create-institute.input';
import { InstituteFilterInput } from './dto/institute-filter.input';
import { UpdateInstituteInfoInput } from './dto/update-institute-info.input';
import { InstituteService } from './institute.service';
import { InstituteModel } from './models/institute.model';
import { InstituteConnection } from './models/institute-connection.model';

@InstituteScope()
@Resolver(() => InstituteModel)
export class InstituteResolver {
  constructor(private readonly instituteService: InstituteService) {}

  @Query(() => InstituteConnection)
  @CheckAbility('read', 'Institute')
  async institutes(
    @Args('filter', { nullable: true }) filter?: InstituteFilterInput,
  ): Promise<InstanceType<typeof InstituteConnection>> {
    return this.instituteService.search(filter ?? {});
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async institute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.findById(id);
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async myInstitute(@CurrentUser() user: AuthUser): Promise<InstituteModel> {
    if (!user.tenantId) {
      throw new Error('Institute scope required to access myInstitute');
    }
    return this.instituteService.findById(user.tenantId);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('create', 'Institute')
  async createInstitute(@Args('input') input: CreateInstituteInput): Promise<InstituteModel> {
    return this.instituteService.create(input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update', 'Institute')
  async updateInstituteInfo(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateInstituteInfoInput,
  ): Promise<InstituteModel> {
    return this.instituteService.updateInfo(id, input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update', 'Institute')
  async activateInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.activate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update', 'Institute')
  async deactivateInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.deactivate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update', 'Institute')
  async suspendInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.suspend(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update', 'Institute')
  async rejectInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.reject(id);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Institute')
  async deleteInstitute(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.instituteService.delete(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('manage', 'Institute')
  async restoreInstitute(@Args('id', { type: () => ID }) id: string): Promise<InstituteModel> {
    return this.instituteService.restore(id);
  }
}
