import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, ResellerScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import GraphQLJSON from 'graphql-type-json';
import { CreateInstituteGroupInput } from '../../institute-group/dto/create-institute-group.input';
import { ResellerInstituteGroupService } from './reseller-institute-group.service';

@UseGuards(GqlAuthGuard, ResellerScopeGuard, AbilityGuard)
@Resolver()
export class ResellerInstituteGroupResolver {
  constructor(private readonly groupService: ResellerInstituteGroupService) {}

  @Mutation(() => GraphQLJSON)
  @CheckAbility('create', 'InstituteGroup')
  async resellerCreateInstituteGroup(@Args('input') input: CreateInstituteGroupInput) {
    return this.groupService.create(input);
  }

  @Query(() => GraphQLJSON)
  @CheckAbility('read', 'InstituteGroup')
  async resellerListInstituteGroups() {
    return this.groupService.list();
  }
}
