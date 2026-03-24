import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ResellerScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import GraphQLJSON from 'graphql-type-json';
import { InstituteFilterInput } from '../../institute/management/dto/institute-filter.input';
import { InstituteModel } from '../../institute/management/models/institute.model';
import { InstituteConnection } from '../../institute/management/models/institute-connection.model';
import { ResellerCreateInstituteRequestInput } from './dto/reseller-create-institute-request.input';
import { ResellerInstituteService } from './reseller-institute.service';

@ResellerScope()
@UseGuards(AbilityGuard)
@Resolver(() => InstituteModel)
export class ResellerInstituteResolver {
  constructor(private readonly resellerInstituteService: ResellerInstituteService) {}

  @Mutation(() => InstituteModel)
  @CheckAbility('create', 'Institute')
  async resellerCreateInstituteRequest(@Args('input') input: ResellerCreateInstituteRequestInput) {
    return this.resellerInstituteService.createRequest(input);
  }

  @Query(() => InstituteConnection)
  @CheckAbility('read', 'Institute')
  async resellerListInstitutes(@Args('filter', { nullable: true }) filter?: InstituteFilterInput) {
    return this.resellerInstituteService.list(filter ?? {});
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async resellerGetInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.resellerInstituteService.findById(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update_status', 'Institute')
  async resellerSuspendInstitute(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { nullable: true }) reason?: string,
  ) {
    return this.resellerInstituteService.suspend(id, reason);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update_status', 'Institute')
  async resellerReactivateInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.resellerInstituteService.reactivate(id);
  }

  @Query(() => GraphQLJSON)
  @CheckAbility('view_statistics', 'Institute')
  async resellerInstituteStatistics() {
    return this.resellerInstituteService.getStatistics();
  }
}
