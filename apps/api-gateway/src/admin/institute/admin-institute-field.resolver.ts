/**
 * Platform-scope field resolvers decorating `InstituteModel` with admin-only
 * joined fields (reseller name, group name).
 *
 * Uses `AdminInstituteLoaders` — a request-scoped DataLoader bundle — so N
 * institutes in a single query issue at most 2 extra DB round-trips total,
 * one batch per field. See `admin-institute.loaders.ts`.
 *
 * Not added to the base `InstituteModel` ObjectType: institute- and reseller-
 * scoped queries do not need the joins.
 */
import { UseGuards } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, PlatformScopeGuard } from '@roviq/auth-backend';
import { InstituteModel } from '../../institute/management/models/institute.model';
import { AdminInstituteLoaders } from './admin-institute.loaders';

@UseGuards(GqlAuthGuard, PlatformScopeGuard)
@Resolver(() => InstituteModel)
export class AdminInstituteFieldResolver {
  constructor(private readonly loaders: AdminInstituteLoaders) {}

  @ResolveField(() => String, {
    nullable: true,
    description:
      'Reseller display name — joined on resellers.name. Platform-admin scope only; batched via DataLoader.',
  })
  async resellerName(@Parent() institute: { resellerId?: string | null }): Promise<string | null> {
    if (!institute.resellerId) return null;
    return this.loaders.resellerName.load(institute.resellerId);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      'Institute group display name — joined on institute_groups.name (English key of i18nText). Platform-admin scope only; batched via DataLoader.',
  })
  async groupName(@Parent() institute: { groupId?: string | null }): Promise<string | null> {
    if (!institute.groupId) return null;
    return this.loaders.groupName.load(institute.groupId);
  }
}
