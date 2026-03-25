import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import type { AppAbility } from '@roviq/common-types';
import { getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  type I18nContent,
  i18nDisplay,
  SYSTEM_USER_ID,
  softDelete,
} from '@roviq/database';
import { BillingPeriod } from '@roviq/domain';
import type {
  BillingInterval,
  FeatureLimits,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionStatus,
} from '@roviq/ee-billing-types';
import { plans } from '@roviq/ee-database';
import {
  PaymentGatewayError,
  PaymentGatewayFactory,
  type ProviderWebhookEvent,
} from '@roviq/ee-payments';
import { billingError } from './billing.errors';
import { BillingRepository } from './billing.repository';
import type { SubscriptionConnection } from './models/subscription.model';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly repo: BillingRepository,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly config: ConfigService,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  private rethrowGatewayError(error: unknown): never {
    if (error instanceof PaymentGatewayError) {
      this.logger.error(`Payment gateway error: ${error.message}`, error.providerError);
      throw new BadGatewayException(error.message);
    }
    throw error;
  }

  async createPlan(input: {
    name: I18nContent;
    description?: I18nContent;
    amount: bigint;
    currency: string;
    interval: BillingInterval;
    entitlements: FeatureLimits;
    resellerId: string;
    code: string;
  }) {
    const { userId } = getRequestContext();

    const plan = await this.repo.createPlan({
      name: input.name,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      interval: input.interval,
      entitlements: input.entitlements,
      resellerId: input.resellerId,
      code: input.code,
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent('BILLING.plan.created', { id: plan.id, name: plan.name });
    return plan;
  }

  async updatePlan(
    id: string,
    input: {
      name?: I18nContent;
      description?: I18nContent;
      amount?: bigint;
      interval?: BillingInterval;
      entitlements?: FeatureLimits;
    },
  ) {
    type UpdatePlanData = Parameters<BillingRepository['updatePlan']>[1];
    const data: UpdatePlanData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.interval !== undefined) data.interval = input.interval;
    if (input.entitlements !== undefined) data.entitlements = input.entitlements;

    const plan = await this.repo.updatePlan(id, data);
    this.emitEvent('BILLING.plan.updated', { id });
    return plan;
  }

  async archivePlan(id: string) {
    const plan = await this.repo.findPlanById(id);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const { activeSubscriptionCount } = await this.repo.findPlanWithSubscriptionCount(id);
    if (activeSubscriptionCount > 0) {
      throw new BadRequestException(
        'Cannot archive a plan with active subscriptions. Cancel or migrate them first.',
      );
    }

    const archived = await this.repo.archivePlan(id);
    this.emitEvent('BILLING.plan.archived', { id });
    return archived;
  }

  async restorePlan(id: string) {
    const plan = await this.repo.findPlanById(id);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    if (plan.status !== 'INACTIVE') {
      throw new BadRequestException('Only inactive plans can be restored');
    }

    const restored = await this.repo.restorePlan(id);
    this.emitEvent('BILLING.plan.restored', { id });
    return restored;
  }

  async deletePlan(id: string) {
    await softDelete(this.db, plans, id);
    this.emitEvent('BILLING.plan.deleted', { id });
  }

  async findAllPlans(ability?: AppAbility) {
    return this.repo.findAllPlans(ability);
  }

  async findPlan(id: string, ability?: AppAbility) {
    const plan = await this.repo.findPlanById(id, ability);
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async assignPlanToInstitute(
    input: {
      tenantId: string;
      resellerId: string;
      planId: string;
      provider: PaymentProvider;
      customerEmail: string;
      customerPhone: string;
    },
    ability?: AppAbility,
  ) {
    if (ability && !ability.can('create', 'Subscription')) {
      throw new ForbiddenException('Not allowed to create subscriptions for this institute');
    }

    const existing = await this.repo.findSubscriptionByInstitute(input.tenantId);
    if (existing && !['CANCELLED', 'EXPIRED'].includes(existing.status)) {
      throw new BadRequestException('Institute already has an active subscription');
    }

    const plan = await this.repo.findPlanById(input.planId);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    if (plan.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot assign a non-active plan');
    }

    if (plan.resellerId !== input.resellerId) {
      throw new ForbiddenException('Plan does not belong to this reseller');
    }

    const { userId } = getRequestContext();

    if (plan.amount === 0n) {
      const subscription = await this.repo.createSubscription({
        tenantId: input.tenantId,
        resellerId: input.resellerId,
        planId: input.planId,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      });

      this.emitEvent('BILLING.subscription.created', {
        subscriptionId: subscription.id,
        tenantId: input.tenantId,
      });

      return { subscription, checkoutUrl: null };
    }

    if (input.provider !== 'RAZORPAY' && input.provider !== 'CASHFREE') {
      billingError(
        'GATEWAY_NOT_CONFIGURED',
        `${input.provider} does not support gateway checkout — use manual payment`,
      );
    }

    const gateway = this.gatewayFactory.getForProvider(input.provider);
    const institute = await this.repo.findInstituteById(input.tenantId);

    let providerPlan: Awaited<ReturnType<typeof gateway.createPlan>>;
    let providerSub: Awaited<ReturnType<typeof gateway.createSubscription>>;
    try {
      providerPlan = await gateway.createPlan({
        name: i18nDisplay(plan.name),
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval as BillingInterval,
        description: i18nDisplay(plan.description) || undefined,
      });

      const returnUrl = this.config.getOrThrow<string>('BILLING_RETURN_URL');
      providerSub = await gateway.createSubscription({
        providerPlanId: providerPlan.providerPlanId,
        customer: {
          name: i18nDisplay(institute.name),
          email: input.customerEmail,
          phone: input.customerPhone,
        },
        returnUrl,
      });
    } catch (error) {
      this.rethrowGatewayError(error);
    }

    await this.repo.upsertGatewayConfig(input.resellerId, input.provider);

    const subscription = await this.repo.createSubscription({
      tenantId: input.tenantId,
      resellerId: input.resellerId,
      planId: input.planId,
      status: 'ACTIVE',
      gatewaySubscriptionId: providerSub.providerSubscriptionId,
      gatewayProvider: input.provider,
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent('BILLING.subscription.created', {
      subscriptionId: subscription.id,
      tenantId: input.tenantId,
    });

    return { subscription, checkoutUrl: providerSub.checkoutUrl };
  }

  async cancelSubscription(subscriptionId: string, atCycleEnd = true, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (ability && !ability.can('update', 'Subscription')) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (['CANCELLED', 'EXPIRED'].includes(sub.status)) {
      throw new BadRequestException('Subscription is already cancelled or expired');
    }

    if (sub.gatewaySubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.tenantId);
        await gateway.cancelSubscription(sub.gatewaySubscriptionId, atCycleEnd);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    const updated = atCycleEnd
      ? await this.repo.updateSubscription(subscriptionId, { cancelledAt: new Date() })
      : await this.repo.updateSubscription(subscriptionId, {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        });

    this.emitEvent('BILLING.subscription.cancelled', { subscriptionId });
    return updated;
  }

  async pauseSubscription(subscriptionId: string, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (ability && !ability.can('update', 'Subscription')) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    if (sub.gatewaySubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.tenantId);
        await gateway.pauseSubscription(sub.gatewaySubscriptionId);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    const updated = await this.repo.updateSubscription(subscriptionId, { status: 'PAUSED' });
    this.emitEvent('BILLING.subscription.paused', { subscriptionId });
    return updated;
  }

  async resumeSubscription(subscriptionId: string, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (ability && !ability.can('update', 'Subscription')) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'PAUSED') {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    if (sub.gatewaySubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.tenantId);
        await gateway.resumeSubscription(sub.gatewaySubscriptionId);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    const updated = await this.repo.updateSubscription(subscriptionId, { status: 'ACTIVE' });
    this.emitEvent('BILLING.subscription.resumed', { subscriptionId });
    return updated;
  }

  async findAllInstitutes() {
    return this.repo.findAllInstitutes();
  }

  async findSubscription(instituteId: string, ability?: AppAbility) {
    return this.repo.findSubscriptionByInstitute(instituteId, ability);
  }

  async findAllSubscriptions(params: {
    filter?: { status?: SubscriptionStatus };
    first?: number;
    after?: string;
    ability?: AppAbility;
  }): Promise<SubscriptionConnection> {
    const take = Math.min(params.first ?? 20, 100);
    const { items, totalCount } = await this.repo.findAllSubscriptions({
      filter: params.filter,
      first: take + 1,
      after: params.after,
      ability: params.ability,
    });

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((item) => ({
      cursor: item.id,
      node: item,
    }));

    return {
      edges,
      totalCount,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!params.after,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
    };
  }

  async findInvoices(params: {
    instituteId?: string;
    filter?: { status?: InvoiceStatus; from?: Date; to?: Date };
    first?: number;
    after?: string;
    ability?: AppAbility;
  }) {
    const take = Math.min(params.first ?? 20, 100);
    const { items, totalCount } = await this.repo.findInvoices({
      instituteId: params.instituteId,
      filter: params.filter,
      first: take + 1,
      after: params.after,
      ability: params.ability,
    });

    const hasNextPage = items.length > take;
    const sliced = items.slice(0, take);

    return { items: sliced, totalCount, hasNextPage };
  }

  async processWebhookEvent(provider: 'CASHFREE' | 'RAZORPAY', event: ProviderWebhookEvent) {
    const subscription = event.providerSubscriptionId
      ? await this.repo.findSubscriptionByProviderId(event.providerSubscriptionId)
      : null;

    if (subscription) {
      await this.handleSubscriptionEvent(subscription.id, event);
    }

    this.emitEvent(`BILLING.webhook.${provider.toLowerCase()}`, {
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      subscriptionId: subscription?.id,
      tenantId: subscription?.tenantId,
      provider,
    });
  }

  private async handleSubscriptionEvent(subscriptionId: string, event: ProviderWebhookEvent) {
    const eventType = event.eventType.toLowerCase();

    switch (eventType) {
      case 'subscription.activated':
        await this.activateWithInvoice(subscriptionId, event, false);
        break;
      case 'subscription.charged':
      case 'payment.captured':
        await this.activateWithInvoice(subscriptionId, event, true);
        break;
      case 'subscription.resumed':
        await this.repo.updateSubscription(subscriptionId, { status: 'ACTIVE' });
        break;
      case 'subscription.halted':
        await this.repo.updateSubscription(subscriptionId, { status: 'PAST_DUE' });
        break;
      case 'subscription.cancelled':
        await this.repo.updateSubscription(subscriptionId, {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        });
        break;
      case 'subscription.paused':
        await this.repo.updateSubscription(subscriptionId, { status: 'PAUSED' });
        break;
      case 'subscription.updated':
      case 'subscription.card_expiry_reminder':
        this.logger.log(`Subscription ${subscriptionId} received ${event.eventType}`);
        break;
      default:
        if (eventType.startsWith('payment.')) {
          this.logger.log(
            `Payment-level event for subscription ${subscriptionId}: ${event.eventType}`,
          );
        } else {
          this.logger.warn(`Unhandled subscription webhook event: ${event.eventType}`);
        }
    }
  }

  private async activateWithInvoice(
    subscriptionId: string,
    event: ProviderWebhookEvent,
    createInvoice: boolean,
  ) {
    const sub = await this.repo.updateSubscriptionWithPlan(subscriptionId, {
      status: 'ACTIVE',
    });

    if (createInvoice && event.providerPaymentId) {
      const existing = await this.repo.findInvoiceByGatewayPaymentId(event.providerPaymentId);
      if (!existing) {
        const now = new Date();
        const period = BillingPeriod.fromInterval(now, sub.plan.interval as BillingInterval);

        await this.repo.createInvoice({
          subscriptionId,
          tenantId: sub.tenantId,
          resellerId: sub.resellerId,
          invoiceNumber: `INV-${Date.now()}`,
          totalAmount: sub.plan.amount,
          currency: sub.plan.currency,
          status: 'PAID',
          periodStart: period.start,
          periodEnd: period.end,
          paidAt: now,
          dueAt: now,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        });
      }
    }
  }
}
