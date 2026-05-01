import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { assertResellerContext, CurrentUser, ResellerScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { i18nDisplay } from '@roviq/database';
import { billingError } from '../billing.errors';
import { AssignPlanInput } from '../dto/assign-plan.input';
import { BillingFilterInput } from '../dto/billing-filter.input';
import { CancelSubscriptionInput } from '../dto/cancel-subscription.input';
import { ChangePlanInput } from '../dto/change-plan.input';
import { CreateGatewayConfigInput } from '../dto/create-gateway-config.input';
import { CreatePlanInput } from '../dto/create-plan.input';
import { GenerateInvoiceInput } from '../dto/generate-invoice.input';
import { ManualPaymentInput } from '../dto/manual-payment.input';
import { PauseSubscriptionInput } from '../dto/pause-subscription.input';
import { RefundInput } from '../dto/refund.input';
import { RejectUpiInput } from '../dto/reject-upi.input';
import { UpdateGatewayConfigInput } from '../dto/update-gateway-config.input';
import { UpdatePlanInput } from '../dto/update-plan.input';
import { AssignPlanResult } from '../models/assign-plan-result.model';
import { BillingDashboardModel } from '../models/billing-dashboard.model';
import { InvoiceModel } from '../models/invoice.model';
import { PaymentModel } from '../models/payment.model';
import { PaymentGatewayConfigModel } from '../models/payment-gateway-config.model';
import { SubscriptionModel } from '../models/subscription.model';
import { SubscriptionPlanModel } from '../models/subscription-plan.model';
import { DashboardService } from './dashboard.service';
import { GatewayConfigService } from './gateway-config.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';

/** Extract resellerId from JWT — guaranteed present by @ResellerScope() guard */
function rid(user: AuthUser): string {
  assertResellerContext(user);
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
    private readonly gatewayConfigService: GatewayConfigService,
    private readonly dashboardService: DashboardService,
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

  /** Deactivate a plan (ACTIVE → INACTIVE). Existing subscribers keep their plan until renewal. */
  @Mutation(() => SubscriptionPlanModel, {
    name: 'archivePlan',
    description:
      'Archive (deactivate) a subscription plan. Blocks new subscriptions but does not affect existing ones.',
  })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async resellerArchivePlan(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.planService.archivePlan(rid(user), id);
  }

  /** Reactivate an archived plan (INACTIVE → ACTIVE). Makes it available for new subscriptions again. */
  @Mutation(() => SubscriptionPlanModel, {
    name: 'restorePlan',
    description:
      'Restore an archived plan back to active. New subscriptions can be created against it again.',
  })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'SubscriptionPlan')
  async resellerRestorePlan(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.planService.restorePlan(rid(user), id);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions (ROV-116)
  // ---------------------------------------------------------------------------

  @Mutation(() => AssignPlanResult, { name: 'assignPlanToInstitute' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Subscription')
  async resellerAssignPlan(@CurrentUser() user: AuthUser, @Args('input') input: AssignPlanInput) {
    const subscription = await this.subscriptionService.assignPlan(rid(user), {
      tenantId: input.tenantId,
      planId: input.planId,
    });
    return { subscription, checkoutUrl: null };
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
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
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

  // ---------------------------------------------------------------------------
  // Gateway configs (ROV-122)
  // ---------------------------------------------------------------------------

  @Query(() => [PaymentGatewayConfigModel], { name: 'gatewayConfigs' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'PaymentGatewayConfig')
  async resellerListGatewayConfigs(@CurrentUser() user: AuthUser) {
    return this.gatewayConfigService.listConfigs(rid(user));
  }

  @Mutation(() => PaymentGatewayConfigModel, { name: 'createGatewayConfig' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'PaymentGatewayConfig')
  async resellerCreateGatewayConfig(
    @CurrentUser() user: AuthUser,
    @Args('input') input: CreateGatewayConfigInput,
  ) {
    return this.gatewayConfigService.createConfig(rid(user), input);
  }

  @Mutation(() => PaymentGatewayConfigModel, { name: 'updateGatewayConfig' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'PaymentGatewayConfig')
  async resellerUpdateGatewayConfig(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGatewayConfigInput,
  ) {
    return this.gatewayConfigService.updateConfig(rid(user), id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteGatewayConfig' })
  @UseGuards(AbilityGuard)
  @CheckAbility('delete', 'PaymentGatewayConfig')
  async resellerDeleteGatewayConfig(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    await this.gatewayConfigService.deleteConfig(rid(user), id);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Dashboard (ROV-127)
  // ---------------------------------------------------------------------------

  @Query(() => BillingDashboardModel, { name: 'resellerBillingDashboard' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'BillingDashboard')
  async resellerBillingDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getDashboard(rid(user));
  }

  // ---------------------------------------------------------------------------
  // UPI P2P verification (ROV-119 — reseller verifies/rejects UPI proofs)
  // ---------------------------------------------------------------------------

  @Query(() => [PaymentModel], { name: 'unverifiedPayments' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Payment')
  async resellerUnverifiedPayments(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    const { items } = await this.paymentService.findUnverifiedPayments(
      rid(user),
      first ?? 20,
      after,
    );
    return items;
  }

  @Mutation(() => PaymentModel, { name: 'verifyUpiPayment' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Payment')
  async resellerVerifyUpiPayment(
    @CurrentUser() user: AuthUser,
    @Args('paymentId', { type: () => ID }) paymentId: string,
  ) {
    return this.paymentService.verifyUpiPayment(rid(user), paymentId, user.membershipId);
  }

  @Mutation(() => PaymentModel, { name: 'rejectUpiPayment' })
  @UseGuards(AbilityGuard)
  @CheckAbility('update', 'Payment')
  async resellerRejectUpiPayment(
    @CurrentUser() user: AuthUser,
    @Args('input') input: RejectUpiInput,
  ) {
    return this.paymentService.rejectUpiPayment(rid(user), input.paymentId, input.reason);
  }
}
