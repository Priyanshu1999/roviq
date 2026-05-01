import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '../../common/pubsub';
import { AdmissionService } from './admission.service';
import { CreateEnquiryInput } from './dto/create-enquiry.input';
import { EnquiryFilterInput } from './dto/enquiry-filter.input';
import { UpdateEnquiryInput } from './dto/update-enquiry.input';
import { ApplicationModel } from './models/application.model';
import { EnquiryConnection, EnquiryModel } from './models/enquiry.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => EnquiryModel)
export class EnquiryResolver {
  constructor(private readonly admissionService: AdmissionService) {}

  @Query(() => EnquiryConnection, { description: 'List enquiries with filters and pagination' })
  @CheckAbility('read', 'Enquiry')
  async listEnquiries(
    @Args('filter', { nullable: true }) filter?: EnquiryFilterInput,
  ): Promise<InstanceType<typeof EnquiryConnection>> {
    return this.admissionService.listEnquiries(filter ?? {});
  }

  @Mutation(() => EnquiryModel, { description: 'Create a pre-admission enquiry' })
  @CheckAbility('create', 'Enquiry')
  async createEnquiry(@Args('input') input: CreateEnquiryInput): Promise<EnquiryModel> {
    return this.admissionService.createEnquiry(input);
  }

  @Mutation(() => EnquiryModel, { description: 'Update an enquiry' })
  @CheckAbility('update', 'Enquiry')
  async updateEnquiry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEnquiryInput,
  ): Promise<EnquiryModel> {
    return this.admissionService.updateEnquiry(id, input);
  }

  @Mutation(() => ApplicationModel, { description: 'Convert enquiry to a formal application' })
  @CheckAbility('create', 'Application')
  async convertEnquiryToApplication(
    @Args('enquiryId', { type: () => ID }) enquiryId: string,
    @Args('standardId', { type: () => ID }) standardId: string,
    @Args('academicYearId', { type: () => ID }) academicYearId: string,
  ): Promise<ApplicationModel> {
    return this.admissionService.convertEnquiryToApplication(enquiryId, standardId, academicYearId);
  }

  @Subscription(() => EnquiryModel, {
    description: 'Real-time new enquiry notifications',
    filter: (
      payload: { enquiryCreated: { tenantId: string } },
      _args: unknown,
      context: { req: { user: import('@roviq/common-types').InstituteContext } },
    ) => payload.enquiryCreated.tenantId === context.req.user.tenantId,
  })
  enquiryCreated() {
    return pubSub.asyncIterableIterator('ENQUIRY.created');
  }
}
