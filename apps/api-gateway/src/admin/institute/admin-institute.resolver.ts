import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, PlatformScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { InstituteService } from '../../institute/management/institute.service';
import { InstituteModel } from '../../institute/management/models/institute.model';
import { InstituteConnection } from '../../institute/management/models/institute-connection.model';
import { InstituteStatisticsModel } from '../../institute/management/models/institute-statistics.model';
import { AdminInstituteService } from './admin-institute.service';
import { AdminCreateInstituteInput } from './dto/admin-create-institute.input';
import { AdminListInstitutesFilterInput } from './dto/admin-list-institutes-filter.input';

@UseGuards(GqlAuthGuard, PlatformScopeGuard, AbilityGuard)
@Resolver(() => InstituteModel)
export class AdminInstituteResolver {
  constructor(
    private readonly instituteService: InstituteService,
    private readonly adminService: AdminInstituteService,
  ) {}

  @Query(() => InstituteConnection)
  @CheckAbility('read', 'Institute')
  async adminListInstitutes(
    @Args('filter', { nullable: true }) filter?: AdminListInstitutesFilterInput,
  ) {
    return this.adminService.list(filter ?? {});
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async adminGetInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.findById(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('create', 'Institute')
  async adminCreateInstitute(@Args('input') input: AdminCreateInstituteInput) {
    return this.instituteService.create(input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('approve', 'Institute')
  async adminApproveInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.adminService.approve(id);
  }

  @Mutation(() => InstituteModel, {
    description:
      'Activate institute (PENDING/INACTIVE/SUSPENDED → ACTIVE). Requires setup_status COMPLETED.',
  })
  @CheckAbility('activate', 'Institute')
  async adminActivateInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.activate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('reject', 'Institute')
  async adminRejectInstitute(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason') reason: string,
  ) {
    return this.adminService.reject(id, reason);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('deactivate', 'Institute')
  async adminDeactivateInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.deactivate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('suspend', 'Institute')
  async adminSuspendInstitute(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { nullable: true }) reason?: string,
  ) {
    return this.instituteService.suspend(id, reason);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Institute')
  async adminDeleteInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.delete(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('restore', 'Institute')
  async adminRestoreInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.restore(id);
  }

  @Query(() => InstituteStatisticsModel)
  @CheckAbility('view_statistics', 'Institute')
  async adminInstituteStatistics() {
    return this.adminService.getStatistics();
  }
}
