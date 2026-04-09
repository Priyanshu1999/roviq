import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { i18nDisplay } from '@roviq/database';
import { BillingPeriod } from '@roviq/domain';
import type { BillingInterval } from '@roviq/ee-billing-types';
import { pubSub } from '@roviq/pubsub';
import { getRequestContext } from '@roviq/request-context';
import { billingError } from '../billing.errors';
import { PlanRepository } from '../repositories/plan.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { InvoiceService } from './invoice.service';

// ---------------------------------------------------------------------------
// Status transition map — defines valid transitions
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, string[]> = {
  /** Trial period — can activate (on first payment), expire (trial ends), or cancel */
  TRIALING: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  /** Active — can pause, fall behind on payment, or cancel */
  ACTIVE: ['PAUSED', 'PAST_DUE', 'CANCELLED'],
  /** Paused by reseller — can resume (→active) or cancel */
  PAUSED: ['ACTIVE', 'CANCELLED'],
  /** Payment overdue — can recover (→active on payment) or cancel (grace expired) */
  PAST_DUE: ['ACTIVE', 'CANCELLED'],
};

function assertTransition(current: string, target: string): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    billingError('SUBSCRIPTION_TERMINAL', `Cannot transition from ${current} to ${target}`);
  }
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly planRepo: PlanRepository,
    private readonly invoiceService: InvoiceService,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
    pubSub.publish(pattern, data);
  }

  // ---------------------------------------------------------------------------
  // Assign plan to institute
  // ---------------------------------------------------------------------------

  async assignPlan(resellerId: string, input: { tenantId: string; planId: string }) {
    // Check no active subscription exists
    const existing = await this.subscriptionRepo.findActiveByTenant(resellerId, input.tenantId);
    if (existing) {
      billingError('SUBSCRIPTION_EXISTS', 'Institute already has an active subscription');
    }

    // Fetch and validate plan
    const plan = await this.planRepo.findById(resellerId, input.planId);
    if (!plan) billingError('PLAN_NOT_FOUND', 'Subscription plan not found');
    if (plan.status !== 'ACTIVE') billingError('PLAN_NOT_FOUND', 'Plan is not active');
    if (plan.resellerId !== resellerId) {
      billingError('PLAN_NOT_FOUND', 'Plan does not belong to this reseller');
    }

    const { userId } = getRequestContext();
    const now = new Date();
    const hasTrial = plan.trialDays > 0;
    const period = BillingPeriod.fromInterval(now, plan.interval as BillingInterval);

    const subscription = await this.subscriptionRepo.create(resellerId, {
      tenantId: input.tenantId,
      resellerId,
      planId: input.planId,
      status: hasTrial ? 'TRIALING' : 'ACTIVE',
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      trialEndsAt: hasTrial ? new Date(now.getTime() + plan.trialDays * 86_400_000) : null,
      createdBy: userId,
      updatedBy: userId,
    });

    // Generate first invoice for non-trial plans (before emitting event)
    if (!hasTrial && plan.amount > 0n) {
      const planName = i18nDisplay(plan.name as Record<string, string>) || 'Plan';
      await this.invoiceService.generateInvoice(resellerId, 'RVQ', {
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        planName,
        planAmountPaise: plan.amount,
        periodStart: period.start,
        periodEnd: period.end,
      });
    }

    // Emit after invoice is generated to avoid inconsistent state
    this.emitEvent('BILLING.subscription.created', {
      subscriptionId: subscription.id,
      tenantId: input.tenantId,
      planId: input.planId,
      status: subscription.status,
    });

    return subscription;
  }

  // ---------------------------------------------------------------------------
  // Change plan (proration)
  // ---------------------------------------------------------------------------

  async changePlan(resellerId: string, subscriptionId: string, newPlanId: string) {
    const sub = await this.subscriptionRepo.findById(resellerId, subscriptionId);
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    if (!['ACTIVE', 'TRIALING'].includes(sub.status)) {
      billingError(
        'SUBSCRIPTION_TERMINAL',
        'Only active or trialing subscriptions can change plan',
      );
    }

    const newPlan = await this.planRepo.findById(resellerId, newPlanId);
    if (!newPlan) billingError('PLAN_NOT_FOUND', 'New plan not found');
    if (newPlan.status !== 'ACTIVE') billingError('PLAN_NOT_FOUND', 'New plan is not active');

    // Calculate proration
    const now = Date.now();
    const periodStart = sub.currentPeriodStart?.getTime() ?? now;
    const periodEnd = sub.currentPeriodEnd?.getTime() ?? now;
    const totalPeriod = periodEnd - periodStart;
    const remainingPeriod = Math.max(0, periodEnd - now);
    const remainingFraction = totalPeriod > 0 ? remainingPeriod / totalPeriod : 0;

    const oldAmount = Number(sub.plan.amount);
    const newAmount = Number(newPlan.amount);
    const credit = Math.round(remainingFraction * oldAmount);
    const charge = Math.round(remainingFraction * newAmount);
    const prorationDelta = charge - credit;

    const updated = await this.subscriptionRepo.update(resellerId, subscriptionId, {
      planId: newPlanId,
      metadata: {
        ...((sub.metadata as Record<string, unknown>) ?? {}),
        lastPlanChange: {
          oldPlanId: sub.planId,
          newPlanId,
          prorationDelta,
          credit,
          charge,
          changedAt: new Date().toISOString(),
        },
      },
    });

    this.emitEvent('BILLING.subscription.plan_changed', {
      subscriptionId,
      oldPlanId: sub.planId,
      newPlanId,
      prorationDelta,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  async pauseSubscription(resellerId: string, subscriptionId: string, reason?: string) {
    const sub = await this.subscriptionRepo.findById(resellerId, subscriptionId);
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    assertTransition(sub.status, 'PAUSED');

    const updated = await this.subscriptionRepo.update(resellerId, subscriptionId, {
      status: 'PAUSED',
      pausedAt: new Date(),
      pauseReason: reason ?? null,
    });

    this.emitEvent('BILLING.subscription.paused', { subscriptionId, tenantId: sub.tenantId });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Resume
  // ---------------------------------------------------------------------------

  async resumeSubscription(resellerId: string, subscriptionId: string) {
    const sub = await this.subscriptionRepo.findById(resellerId, subscriptionId);
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    assertTransition(sub.status, 'ACTIVE');

    const updated = await this.subscriptionRepo.update(resellerId, subscriptionId, {
      status: 'ACTIVE',
      pausedAt: null,
      pauseReason: null,
    });

    this.emitEvent('BILLING.subscription.activated', { subscriptionId, tenantId: sub.tenantId });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------

  async cancelSubscription(resellerId: string, subscriptionId: string, reason?: string) {
    const sub = await this.subscriptionRepo.findById(resellerId, subscriptionId);
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    assertTransition(sub.status, 'CANCELLED');

    const updated = await this.subscriptionRepo.update(resellerId, subscriptionId, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    });

    this.emitEvent('BILLING.subscription.cancelled', { subscriptionId, tenantId: sub.tenantId });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Expire (trial ended without payment)
  // ---------------------------------------------------------------------------

  async expireSubscription(resellerId: string, subscriptionId: string) {
    const sub = await this.subscriptionRepo.findById(resellerId, subscriptionId);
    if (!sub) billingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    assertTransition(sub.status, 'EXPIRED');

    const updated = await this.subscriptionRepo.update(resellerId, subscriptionId, {
      status: 'EXPIRED',
    });

    this.emitEvent('BILLING.subscription.expired', { subscriptionId, tenantId: sub.tenantId });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // List / Read
  // ---------------------------------------------------------------------------

  async listSubscriptions(
    resellerId: string,
    params: { status?: string; first: number; after?: string },
  ) {
    return this.subscriptionRepo.findByResellerId(resellerId, params);
  }

  async getSubscription(resellerId: string, subscriptionId: string) {
    return this.subscriptionRepo.findById(resellerId, subscriptionId);
  }

  /** Institute-scoped: returns null when no active subscription (not an error) */
  async getActiveByTenant(resellerId: string, tenantId: string) {
    return this.subscriptionRepo.findActiveByTenant(resellerId, tenantId);
  }
}
