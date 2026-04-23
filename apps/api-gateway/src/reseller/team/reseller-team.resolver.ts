import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Field, ID, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, ResellerScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { ResellerInviteTeamMemberInput } from './dto/reseller-invite-team-member.input';
import { ResellerTeamFilterInput } from './dto/reseller-team-filter.input';
import {
  ResellerTeamMemberConnection,
  ResellerTeamMemberModel,
} from './models/reseller-team-member.model';
import { ResellerTeamService } from './reseller-team.service';

@ObjectType({ description: 'Result of inviting a new reseller team member' })
class ResellerInviteTeamMemberResult {
  @Field(() => ID)
  membershipId!: string;
}

@ResellerScope()
@UseGuards(AbilityGuard)
@Resolver(() => ResellerTeamMemberModel)
export class ResellerTeamResolver {
  constructor(private readonly service: ResellerTeamService) {}

  @Query(() => ResellerTeamMemberConnection, {
    description: 'List team members with a reseller-scope membership in this reseller organisation',
  })
  @CheckAbility('read', 'User')
  async resellerListTeamMembers(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: ResellerTeamFilterInput,
  ) {
    if (!user.resellerId) throw new ForbiddenException('Reseller context required');
    return this.service.list(user.resellerId, filter ?? {});
  }

  @Mutation(() => ResellerInviteTeamMemberResult, {
    description:
      'Create a new user and assign them a reseller-scope membership. A welcome notification with a temporary password is dispatched automatically.',
  })
  @CheckAbility('create', 'User')
  async resellerInviteTeamMember(
    @Args('input') input: ResellerInviteTeamMemberInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ResellerInviteTeamMemberResult> {
    if (!user.resellerId) throw new ForbiddenException('Reseller context required');
    return this.service.invite(user.resellerId, user.userId, input);
  }

  @Mutation(() => Boolean, {
    description:
      "Deactivate a team member's reseller-scope membership. The user account is preserved.",
  })
  @CheckAbility('delete', 'User')
  async resellerRemoveTeamMember(
    @Args('membershipId', { type: () => ID }) membershipId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    if (!user.resellerId) throw new ForbiddenException('Reseller context required');
    await this.service.remove(user.resellerId, membershipId);
    return true;
  }
}
