import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import GraphQLJSON from 'graphql-type-json';
import { pubSub } from '../../common/pubsub';
import { CreateGroupInput, GroupFilterInput, UpdateGroupInput } from './dto/create-group.input';
import { GroupService } from './group.service';
import { GroupModel, GroupResolutionUpdate, RulePreviewResult } from './models/group.model';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => GroupModel)
export class GroupResolver {
  constructor(private readonly groupService: GroupService) {}

  @Query(() => [GroupModel], { description: 'List groups with optional filters' })
  @CheckAbility('read', 'Group')
  async listGroups(
    @Args('filter', { nullable: true }) filter?: GroupFilterInput,
  ): Promise<GroupModel[]> {
    return this.groupService.list(filter ?? {});
  }

  @Query(() => GroupModel, { description: 'Get a group by ID' })
  @CheckAbility('read', 'Group')
  async getGroup(@Args('id', { type: () => ID }) id: string): Promise<GroupModel> {
    return this.groupService.findById(id);
  }

  @Mutation(() => GroupModel, {
    description: 'Create a new group (static, dynamic, hybrid, or composite)',
  })
  @CheckAbility('create', 'Group')
  async createGroup(@Args('input') input: CreateGroupInput): Promise<GroupModel> {
    return this.groupService.create(input);
  }

  @Mutation(() => GroupModel, { description: 'Update a group' })
  @CheckAbility('update', 'Group')
  async updateGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGroupInput,
  ): Promise<GroupModel> {
    return this.groupService.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Soft delete a group' })
  @CheckAbility('delete', 'Group')
  async deleteGroup(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.groupService.delete(id);
  }

  @Mutation(() => GroupResolutionUpdate, {
    description: 'Resolve group members (triggers rule evaluation + cache refresh)',
  })
  @CheckAbility('update', 'Group')
  async resolveGroupMembers(
    @Args('groupId', { type: () => ID }) groupId: string,
  ): Promise<GroupResolutionUpdate> {
    return this.groupService.resolveMembers(groupId);
  }

  @Query(() => RulePreviewResult, {
    description: 'Dry-run rule evaluation without saving — returns count + sample',
  })
  @CheckAbility('read', 'Group')
  async previewGroupRule(
    @Args('rule', { type: () => GraphQLJSON }) rule: Record<string, unknown>,
  ): Promise<RulePreviewResult> {
    return this.groupService.previewRule(rule);
  }

  @Subscription(() => GroupResolutionUpdate, {
    description: 'Real-time group resolution updates',
    filter: (
      payload: { groupMembershipResolved: { tenantId?: string } },
      _variables: { groupId: string },
      context: { req: { user: AuthUser } },
    ) => {
      const p = payload.groupMembershipResolved;
      return !p.tenantId || p.tenantId === context.req.user.tenantId;
    },
  })
  groupMembershipResolved(@Args('groupId', { type: () => ID }) _groupId: string) {
    return pubSub.asyncIterableIterator('GROUP.membership_resolved');
  }
}
