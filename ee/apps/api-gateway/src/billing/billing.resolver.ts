import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility, CurrentAbility } from '@roviq/casl';
import type { AppAbility } from '@roviq/common-types';
import { BillingService } from './billing.service';
import { AssignPlanInput } from './dto/assign-plan.input';
import { BillingFilterInput } from './dto/billing-filter.input';
import { CreatePlanInput } from './dto/create-plan.input';
import { ManageSubscriptionInput } from './dto/manage-subscription.input';
import { SubscriptionFilterInput } from './dto/subscription-filter.input';
import { UpdatePlanInput } from './dto/update-plan.input';
import { AssignPlanResult } from './models/assign-plan-result.model';
import { InstituteRef } from './models/institute-ref.model';
import { InvoiceConnection } from './models/invoice.model';
import { SubscriptionConnection, SubscriptionModel } from './models/subscription.model';
import { SubscriptionPlanModel } from './models/subscription-plan.model';

@Resolver()
export class BillingResolver {
  constructor(private readonly billingService: BillingService) {}

  @Mutation(() => SubscriptionPlanModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('create', 'SubscriptionPlan')
  async createSubscriptionPlan(@Args('input') input: CreatePlanInput) {
    return this.billingService.createPlan(input);
  }

  @Mutation(() => SubscriptionPlanModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async updateSubscriptionPlan(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePlanInput,
  ) {
    return this.billingService.updatePlan(id, input);
  }

  @Mutation(() => SubscriptionPlanModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async archivePlan(@Args('id', { type: () => ID }) id: string) {
    return this.billingService.archivePlan(id);
  }

  @Mutation(() => SubscriptionPlanModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async restorePlan(@Args('id', { type: () => ID }) id: string) {
    return this.billingService.restorePlan(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('delete', 'SubscriptionPlan')
  async deletePlan(@Args('id', { type: () => ID }) id: string) {
    await this.billingService.deletePlan(id);
    return true;
  }

  @Mutation(() => AssignPlanResult)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('create', 'Subscription')
  async assignPlanToInstitute(
    @Args('input') input: AssignPlanInput,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.assignPlanToInstitute(input, ability);
  }

  @Mutation(() => SubscriptionModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async cancelSubscription(
    @Args('input') input: ManageSubscriptionInput,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.cancelSubscription(input.subscriptionId, input.atCycleEnd, ability);
  }

  @Mutation(() => SubscriptionModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async pauseSubscription(
    @Args('subscriptionId', { type: () => ID }) subscriptionId: string,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.pauseSubscription(subscriptionId, ability);
  }

  @Mutation(() => SubscriptionModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async resumeSubscription(
    @Args('subscriptionId', { type: () => ID }) subscriptionId: string,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.resumeSubscription(subscriptionId, ability);
  }

  @Query(() => [InstituteRef])
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'Institute')
  async billingInstitutes() {
    return this.billingService.findAllInstitutes();
  }

  @Query(() => [SubscriptionPlanModel])
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'SubscriptionPlan')
  async subscriptionPlans(@CurrentAbility() ability: AppAbility) {
    return this.billingService.findAllPlans(ability);
  }

  @Query(() => SubscriptionPlanModel)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'SubscriptionPlan')
  async subscriptionPlan(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.findPlan(id, ability);
  }

  @Query(() => SubscriptionModel, { nullable: true })
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async subscription(
    @Args('instituteId', { type: () => ID }) instituteId: string,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.billingService.findSubscription(instituteId, ability);
  }

  @Query(() => SubscriptionConnection)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async subscriptions(
    @CurrentAbility() ability: AppAbility,
    @Args('filter', { nullable: true }) filter?: SubscriptionFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    return this.billingService.findAllSubscriptions({ filter, first, after, ability });
  }

  @Query(() => InvoiceConnection)
  @UseGuards(GqlAuthGuard, AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async invoices(
    @CurrentAbility() ability: AppAbility,
    @Args('instituteId', { type: () => ID, nullable: true }) instituteId?: string,
    @Args('filter', { nullable: true }) filter?: BillingFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    return this.billingService.findInvoices({ instituteId, filter, first, after, ability });
  }
}
