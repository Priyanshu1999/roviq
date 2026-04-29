import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { assertResellerContext, CurrentUser, ResellerScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { ResellerListUsersFilterInput } from './dto/reseller-list-users-filter.input';
import { ResellerUserConnection, ResellerUserModel } from './models/reseller-user.model';
import { ResellerUserService } from './reseller-user.service';

@ResellerScope()
@UseGuards(AbilityGuard)
@Resolver(() => ResellerUserModel)
export class ResellerUserResolver {
  constructor(private readonly service: ResellerUserService) {}

  @Query(() => ResellerUserConnection, {
    description: 'List users with memberships in institutes belonging to this reseller',
  })
  @CheckAbility('read', 'User')
  async resellerListUsers(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: ResellerListUsersFilterInput,
  ) {
    assertResellerContext(user);
    return this.service.list(user.resellerId, filter ?? {});
  }
}
