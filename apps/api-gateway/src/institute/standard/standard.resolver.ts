import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateStandardInput } from './dto/create-standard.input';
import { UpdateStandardInput } from './dto/update-standard.input';
import { StandardModel } from './models/standard.model';
import type { StandardRecord } from './repositories/types';
import { StandardService } from './standard.service';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => StandardModel)
export class StandardResolver {
  constructor(private readonly standardService: StandardService) {}

  @Query(() => [StandardModel])
  @CheckAbility('read', 'Standard')
  async standards(
    @Args('academicYearId', { type: () => ID }) academicYearId: string,
  ): Promise<StandardRecord[]> {
    return this.standardService.findByAcademicYear(academicYearId);
  }

  @Query(() => StandardModel)
  @CheckAbility('read', 'Standard')
  async standard(@Args('id', { type: () => ID }) id: string): Promise<StandardRecord> {
    return this.standardService.findById(id);
  }

  @Mutation(() => StandardModel)
  @CheckAbility('create', 'Standard')
  async createStandard(@Args('input') input: CreateStandardInput): Promise<StandardRecord> {
    return this.standardService.create(input);
  }

  @Mutation(() => StandardModel)
  @CheckAbility('update', 'Standard')
  async updateStandard(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStandardInput,
  ): Promise<StandardRecord> {
    return this.standardService.update(id, input);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Standard')
  async deleteStandard(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.standardService.delete(id);
  }
}
