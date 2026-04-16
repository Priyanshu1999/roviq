import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '../../common/pubsub';
import { AdmissionService } from './admission.service';
import { AdmissionStatisticsFilterInput } from './dto/admission-statistics-filter.input';
import { CreateApplicationInput, UpdateApplicationInput } from './dto/create-application.input';
import { ApplicationFilterInput } from './dto/enquiry-filter.input';
import { AdmissionStatisticsModel } from './models/admission-statistics.model';
import {
  ApplicationConnection,
  ApplicationModel,
  ApplicationStatusUpdate,
} from './models/application.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => ApplicationModel)
export class ApplicationResolver {
  constructor(private readonly admissionService: AdmissionService) {}

  @Query(() => ApplicationConnection, { description: 'List applications with filters' })
  @CheckAbility('read', 'Application')
  async listApplications(
    @Args('filter', { nullable: true }) filter?: ApplicationFilterInput,
  ): Promise<InstanceType<typeof ApplicationConnection>> {
    return this.admissionService.listApplications(filter ?? {});
  }

  @Query(() => ApplicationModel, { description: 'Get application by ID' })
  @CheckAbility('read', 'Application')
  async getApplication(@Args('id', { type: () => ID }) id: string): Promise<ApplicationModel> {
    return this.admissionService.getApplication(id);
  }

  @Query(() => AdmissionStatisticsModel, { description: 'Admission funnel statistics' })
  @CheckAbility('read', 'Application')
  async admissionStatistics(
    @Args('filter', { nullable: true }) filter?: AdmissionStatisticsFilterInput,
  ): Promise<AdmissionStatisticsModel> {
    return this.admissionService.statistics(filter);
  }

  @Mutation(() => ApplicationModel, { description: 'Create a direct admission application' })
  @CheckAbility('create', 'Application')
  async createApplication(@Args('input') input: CreateApplicationInput): Promise<ApplicationModel> {
    return this.admissionService.createApplication(input);
  }

  @Mutation(() => ApplicationModel, {
    description: 'Update application status (state machine validated)',
  })
  @CheckAbility('update', 'Application')
  async updateApplication(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateApplicationInput,
  ): Promise<ApplicationModel> {
    return this.admissionService.updateApplication(id, input);
  }

  @Mutation(() => ApplicationModel, {
    description: 'Approve application → triggers StudentAdmissionWorkflow',
  })
  @CheckAbility('update', 'Application')
  async approveApplication(@Args('id', { type: () => ID }) id: string): Promise<ApplicationModel> {
    return this.admissionService.approveAndEnroll(id);
  }

  @Mutation(() => ApplicationModel, { description: 'Reject an application' })
  @CheckAbility('update', 'Application')
  async rejectApplication(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<ApplicationModel> {
    return this.admissionService.rejectApplication(id, reason);
  }

  @Subscription(() => ApplicationStatusUpdate, {
    description: 'Real-time application status changes',
    filter: (
      payload: { applicationStatusChanged: { tenantId: string } },
      _args: unknown,
      context: { req: { user: AuthUser } },
    ) => payload.applicationStatusChanged.tenantId === context.req.user.tenantId,
  })
  applicationStatusChanged() {
    return pubSub.asyncIterableIterator('APPLICATION.status_changed');
  }
}
