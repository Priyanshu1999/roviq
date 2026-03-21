import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { CheckAbility } from '@roviq/casl';
import { CreateStandardInput } from './dto/create-standard.input';
import { UpdateStandardInput } from './dto/update-standard.input';
import { StandardModel } from './models/standard.model';
import { StandardService } from './standard.service';

@InstituteScope()
@Resolver(() => StandardModel)
export class StandardResolver {
  constructor(private readonly standardService: StandardService) {}

  @Query(() => [StandardModel])
  @CheckAbility('read', 'Standard')
  async standards(
    @Args('academicYearId', { type: () => ID }) academicYearId: string,
  ): Promise<StandardModel[]> {
    return this.standardService.findByAcademicYear(academicYearId);
  }

  @Query(() => StandardModel)
  @CheckAbility('read', 'Standard')
  async standard(@Args('id', { type: () => ID }) id: string): Promise<StandardModel> {
    return this.standardService.findById(id);
  }

  @Mutation(() => StandardModel)
  @CheckAbility('create', 'Standard')
  async createStandard(@Args('input') input: CreateStandardInput): Promise<StandardModel> {
    return this.standardService.create(input);
  }

  @Mutation(() => StandardModel)
  @CheckAbility('update', 'Standard')
  async updateStandard(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStandardInput,
  ): Promise<StandardModel> {
    return this.standardService.update(id, input);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Standard')
  async deleteStandard(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.standardService.delete(id);
  }
}
