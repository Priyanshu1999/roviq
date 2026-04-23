/**
 * Scope-agnostic field resolvers for `InstituteModel`.
 *
 * These `@ResolveField` handlers are invoked regardless of which scope
 * fetched the parent institute (institute, reseller, or platform admin).
 * Auth is enforced at the parent query's resolver — by the time we reach
 * a field resolver, the caller has already been authorized to see the
 * institute record, so no additional scope guard is required here.
 */
import { UseGuards } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '@roviq/auth-backend';
import { InstituteService } from './institute.service';
import { InstituteModel } from './models/institute.model';
import { InstituteAffiliationModel } from './models/institute-affiliation.model';
import { InstituteBrandingModel } from './models/institute-branding.model';
import { InstituteConfigModel } from './models/institute-config.model';
import { InstituteIdentifierModel } from './models/institute-identifier.model';

@UseGuards(GqlAuthGuard)
@Resolver(() => InstituteModel)
export class InstituteFieldResolver {
  constructor(private readonly instituteService: InstituteService) {}

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
}
