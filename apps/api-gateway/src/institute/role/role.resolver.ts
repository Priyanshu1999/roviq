import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { UpdateRolePrimaryNavInput } from './dto/update-role-primary-nav.input';
import { RoleModel } from './models/role.model';
import type { RoleRecord } from './repositories/types';
import { InstituteRoleService } from './role.service';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => RoleModel)
export class InstituteRoleResolver {
  constructor(private readonly service: InstituteRoleService) {}

  @Query(() => [RoleModel], {
    description: 'List institute roles available for primary-nav customization.',
  })
  @CheckAbility('read', 'Role')
  async instituteRoles(): Promise<RoleRecord[]> {
    return this.service.list();
  }

  @Mutation(() => RoleModel, {
    description: "Set a role's phone bottom tab bar destinations.",
  })
  @CheckAbility('update', 'Role')
  async updateRolePrimaryNav(
    @Args('input') input: UpdateRolePrimaryNavInput,
  ): Promise<RoleRecord> {
    return this.service.updatePrimaryNavSlugs(input.roleId, input.slugs);
  }
}
