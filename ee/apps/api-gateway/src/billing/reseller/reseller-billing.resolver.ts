import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, ResellerScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { i18nDisplay } from '@roviq/database';
import { billingError } from '../billing.errors';
import { BillingFilterInput } from '../dto/billing-filter.input';
import { CancelSubscriptionInput } from '../dto/cancel-subscription.input';
import { ChangePlanInput } from '../dto/change-plan.input';
import { CreatePlanInput } from '../dto/create-plan.input';
import { GenerateInvoiceInput } from '../dto/generate-invoice.input';
import { ManualPaymentInput } from '../dto/manual-payment.input';
import { PauseSubscriptionInput } from '../dto/pause-subscription.input';
import { RefundInput } from '../dto/refund.input';
import { UpdatePlanInput } from '../dto/update-plan.input';
import { InstituteRef } from '../models/institute-ref.model';
import { InvoiceModel } from '../models/invoice.model';
import { SubscriptionModel } from '../models/subscription.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';

/** Extract resellerId from JWT — guaranteed present by @ResellerScope() guard */
function rid(user: AuthUser): string {
  if (!user.resellerId)
    throw new Error('resellerId missing — ResellerScope guard should prevent this');
  return user.resellerId;
}

/**
 * Reseller-scoped billing resolver.
 * Plan CRUD, subscription lifecycle, invoices — all reseller operations.
 * resellerId auto-extracted from JWT via @CurrentUser().
 */
@Resolver()
@ResellerScope()
export class ResellerBillingResolver {
  constructor(
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
  ) {}

  // ---------------------------------------------------------------------------
  // Plans (ROV-114)
  // ---------------------------------------------------------------------------

  @Query(() => [SubscriptionPlanModel], { name: 'subscriptionPlans' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'SubscriptionPlan')
  async resellerListPlans(
    @CurrentUser() user: AuthUser,
    @Args('status', { nullable: true }) status?: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    const { items } = await this.planService.listPlans(rid(user), {
      status,
      first: first ?? 20,
      after,
    });
    return items;
  }

  @Query(() => SubscriptionPlanModel, { name: 'subscriptionPlan' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'SubscriptionPlan')
  async resellerGetPlan(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    return this.planService.getPlan(rid(user), id);
  }

  @Mutation(() => SubscriptionPlanModel, { name: 'createSubscriptionPlan' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'SubscriptionPlan')
  async resellerCreatePlan(@CurrentUser() user: AuthUser, @Args('input') input: CreatePlanInput) {
    return this.planService.createPlan(rid(user), input);
  }

  @Mutation(() => SubscriptionPlanModel, { name: 'updateSubscriptionPlan' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async resellerUpdatePlan(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePlanInput,
  ) {
    return this.planService.updatePlan(rid(user), id, input);
  }

  @Mutation(() => Boolean, { name: 'deletePlan' })
  @UseGuards(AbilityGuard)
  @CheckAbility('delete', 'SubscriptionPlan')
  async resellerDeletePlan(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    await this.planService.deletePlan(rid(user), id);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Subscriptions (ROV-116)
  // ---------------------------------------------------------------------------

  @Mutation(() => SubscriptionModel, { name: 'assignPlanToInstitute' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Subscription')
  async resellerAssignPlan(
    @CurrentUser() user: AuthUser,
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @Args('planId', { type: () => ID }) planId: string,
  ) {
    return this.subscriptionService.assignPlan(rid(user), { tenantId, planId });
  }

  @Mutation(() => SubscriptionModel, { name: 'changePlan' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async resellerChangePlan(@CurrentUser() user: AuthUser, @Args('input') input: ChangePlanInput) {
    return this.subscriptionService.changePlan(rid(user), input.subscriptionId, input.newPlanId);
  }

  @Mutation(() => SubscriptionModel, { name: 'pauseSubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async resellerPauseSubscription(
    @CurrentUser() user: AuthUser,
    @Args('input') input: PauseSubscriptionInput,
  ) {
    return this.subscriptionService.pauseSubscription(
      rid(user),
      input.subscriptionId,
      input.reason,
    );
  }

  @Mutation(() => SubscriptionModel, { name: 'resumeSubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async resellerResumeSubscription(
    @CurrentUser() user: AuthUser,
    @Args('subscriptionId', { type: () => ID }) subscriptionId: string,
  ) {
    return this.subscriptionService.resumeSubscription(rid(user), subscriptionId);
  }

  @Mutation(() => SubscriptionModel, { name: 'cancelSubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Subscription')
  async resellerCancelSubscription(
    @CurrentUser() user: AuthUser,
    @Args('input') input: CancelSubscriptionInput,
  ) {
    return this.subscriptionService.cancelSubscription(
      rid(user),
      input.subscriptionId,
      input.reason,
    );
  }

  @Query(() => [SubscriptionModel], { name: 'subscriptions' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async resellerListSubscriptions(
    @CurrentUser() user: AuthUser,
    @Args('status', { nullable: true }) status?: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    const { items } = await this.subscriptionService.listSubscriptions(rid(user), {
      status,
      first: first ?? 20,
      after,
    });
    return items;
  }

  // ---------------------------------------------------------------------------
  // Invoices (ROV-119)
  // ---------------------------------------------------------------------------

  @Query(() => [InvoiceModel], { name: 'invoices' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async resellerListInvoices(
    @CurrentUser() user: AuthUser,
    @Args('instituteId', { type: () => ID, nullable: true }) instituteId?: string,
    @Args('filter', { nullable: true }) filter?: BillingFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    const { items } = await this.invoiceService.listInvoices(rid(user), {
      tenantId: instituteId,
      status: filter?.status,
      from: filter?.from,
      to: filter?.to,
      first: first ?? 20,
      after,
    });
    return items;
  }

  @Mutation(() => InvoiceModel, { name: 'generateInvoice' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Invoice')
  async resellerGenerateInvoice(
    @CurrentUser() user: AuthUser,
    @Args('input') input: GenerateInvoiceInput,
  ) {
    const sub = await this.subscriptionService.getSubscription(rid(user), input.subscriptionId);
    if (!sub) billingError('PLAN_NOT_FOUND', 'Subscription not found');
    return this.invoiceService.generateInvoice(rid(user), 'RVQ', {
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      planName: i18nDisplay(sub.plan?.name as Record<string, string>) || 'Plan',
      planAmountPaise: sub.plan?.amount ?? 0n,
      periodStart: sub.currentPeriodStart ?? new Date(),
      periodEnd: sub.currentPeriodEnd ?? new Date(),
    });
  }

  @Mutation(() => InvoiceModel, { name: 'recordManualPayment' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Invoice')
  async resellerRecordManualPayment(
    @CurrentUser() user: AuthUser,
    @Args('invoiceId', { type: () => ID }) invoiceId: string,
    @Args('input') input: ManualPaymentInput,
  ) {
    return this.paymentService.recordManualPayment(rid(user), invoiceId, input);
  }

  @Mutation(() => InvoiceModel, { name: 'issueRefund' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Payment')
  async resellerIssueRefund(
    @CurrentUser() user: AuthUser,
    @Args('paymentId', { type: () => ID }) paymentId: string,
    @Args('input') input: RefundInput,
  ) {
    return this.paymentService.issueRefund(rid(user), paymentId, input);
  }

  @Query(() => [InstituteRef], { name: 'billingInstitutes' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Institute')
  async resellerListInstitutes() {
    // TODO: wire via InstituteService when available
    return [];
  }
}
