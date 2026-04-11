import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { CreateInstituteInput } from './dto/create-institute.input';
import { InstituteFilterInput } from './dto/institute-filter.input';
import { UpdateInstituteBrandingInput } from './dto/update-institute-branding.input';
import { UpdateInstituteConfigInput } from './dto/update-institute-config.input';
import { UpdateInstituteInfoInput } from './dto/update-institute-info.input';
import { InstituteService } from './institute.service';
import { InstituteModel } from './models/institute.model';
import { InstituteAffiliationModel } from './models/institute-affiliation.model';
import { InstituteBrandingModel } from './models/institute-branding.model';
import { InstituteConfigModel } from './models/institute-config.model';
import { InstituteConnection } from './models/institute-connection.model';
import { InstituteIdentifierModel } from './models/institute-identifier.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => InstituteModel)
export class InstituteResolver {
  constructor(private readonly instituteService: InstituteService) {}

  @Query(() => InstituteConnection)
  @CheckAbility('read', 'Institute')
  async institutes(@Args('filter', { nullable: true }) filter?: InstituteFilterInput) {
    return this.instituteService.search(filter ?? {});
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async institute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.findById(id);
  }

  @ResolveField(() => InstituteBrandingModel, { nullable: true })
  async branding(@Parent() institute: { id: string }) {
    return this.instituteService.findBranding(institute.id);
  }

  @ResolveField(() => InstituteConfigModel, { nullable: true })
  async config(@Parent() institute: { id: string }) {
    return this.instituteService.findConfig(institute.id);
  }

  @ResolveField(() => [InstituteIdentifierModel], { nullable: true })
  async identifiers(@Parent() institute: { id: string }) {
    return this.instituteService.findIdentifiers(institute.id);
  }

  @ResolveField(() => [InstituteAffiliationModel], { nullable: true })
  async affiliations(@Parent() institute: { id: string }) {
    return this.instituteService.findAffiliations(institute.id);
  }

  @Query(() => InstituteModel)
  @CheckAbility('read', 'Institute')
  async myInstitute(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('Institute scope required to access myInstitute');
    }
    return this.instituteService.findById(user.tenantId);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('create', 'Institute')
  async createInstitute(@Args('input') input: CreateInstituteInput) {
    return this.instituteService.create(input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update_info', 'Institute')
  async updateInstituteInfo(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateInstituteInfoInput,
  ) {
    return this.instituteService.updateInfo(id, input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update_branding', 'Institute')
  async updateInstituteBranding(
    @CurrentUser() user: AuthUser,
    @Args('input') input: UpdateInstituteBrandingInput,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Institute scope required');
    return this.instituteService.updateBranding(user.tenantId, input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('update_config', 'Institute')
  async updateInstituteConfig(
    @CurrentUser() user: AuthUser,
    @Args('input') input: UpdateInstituteConfigInput,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Institute scope required');
    return this.instituteService.updateConfig(user.tenantId, input);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('activate', 'Institute')
  async activateInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.activate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('deactivate', 'Institute')
  async deactivateInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.deactivate(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('suspend', 'Institute')
  async suspendInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.suspend(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('reject', 'Institute')
  async rejectInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.reject(id);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Institute')
  async deleteInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.delete(id);
  }

  @Mutation(() => InstituteModel)
  @CheckAbility('restore', 'Institute')
  async restoreInstitute(@Args('id', { type: () => ID }) id: string) {
    return this.instituteService.restore(id);
  }
}
