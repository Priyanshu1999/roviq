import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { PlatformScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { AdminUserService } from './admin-user.service';
import { AdminListUsersFilterInput } from './dto/admin-list-users-filter.input';
import { AdminUserConnection, AdminUserModel } from './models/admin-user.model';

@PlatformScope()
@UseGuards(AbilityGuard)
@Resolver(() => AdminUserModel)
export class AdminUserResolver {
  constructor(private readonly service: AdminUserService) {}

  @Query(() => AdminUserConnection, {
    description: 'List all users with pagination, search, and filters (platform admin)',
  })
  @CheckAbility('read', 'User')
  async adminListUsers(@Args('filter', { nullable: true }) filter?: AdminListUsersFilterInput) {
    return this.service.list(filter ?? {});
  }

  @Query(() => [AdminUserModel], {
    description: 'Typeahead search for users by name, username, or phone (platform admin)',
  })
  @CheckAbility('read', 'User')
  async adminSearchUsers(
    @Args('query') query: string,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ) {
    return this.service.search(query, Math.min(limit, 50));
  }
}
