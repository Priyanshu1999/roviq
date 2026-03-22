import { subject } from '@casl/ability';
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
  subscriptionPlans,
} from '@roviq/database';
import { BillingPeriod } from '@roviq/domain';
import type {
  BillingInterval,
  FeatureLimits,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionStatus,
} from '@roviq/ee-billing-types';
import {
  PaymentGatewayError,
  PaymentGatewayFactory,
  type ProviderWebhookEvent,
} from '@roviq/ee-payments';
import { BillingRepository } from './billing.repository';
import type { InvoiceConnection, InvoiceModel } from './models/invoice.model';
import type { SubscriptionConnection, SubscriptionModel } from './models/subscription.model';

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

  /** Re-throw PaymentGatewayError as a NestJS BadGatewayException so GraphQL returns a proper error code. */
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
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    featureLimits: FeatureLimits;
  }) {
    const { userId } = getRequestContext();

    const plan = await this.repo.createPlan({
      name: input.name,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      billingInterval: input.billingInterval,
      featureLimits: input.featureLimits,
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
      amount?: number;
      billingInterval?: BillingInterval;
      featureLimits?: FeatureLimits;
    },
  ) {
    type UpdatePlanData = Parameters<BillingRepository['updatePlan']>[1];
    const data: UpdatePlanData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.billingInterval !== undefined) data.billingInterval = input.billingInterval;
    if (input.featureLimits !== undefined) data.featureLimits = input.featureLimits;

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

    if (plan.status !== 'ARCHIVED') {
      throw new BadRequestException('Only archived plans can be restored');
    }

    const restored = await this.repo.restorePlan(id);
    this.emitEvent('BILLING.plan.restored', { id });
    return restored;
  }

  async deletePlan(id: string) {
    await softDelete(this.db, subscriptionPlans, id);
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
      instituteId: string;
      planId: string;
      provider: PaymentProvider;
      customerEmail: string;
      customerPhone: string;
    },
    ability?: AppAbility,
  ) {
    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can('create', subject('Subscription', { instituteId: input.instituteId }))
    ) {
      throw new ForbiddenException('Not allowed to create subscriptions for this institute');
    }

    const existing = await this.repo.findSubscriptionByInstitute(input.instituteId);
    if (existing && !['CANCELED', 'COMPLETED'].includes(existing.status)) {
      throw new BadRequestException('Institute already has an active subscription');
    }

    const plan = await this.repo.findPlanById(input.planId);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    if (plan.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot assign a non-active plan');
    }

    const { userId } = getRequestContext();

    // Free plans (amount=0) are internal-only — no gateway interaction needed
    if (plan.amount === 0) {
      const subscription = await this.repo.createSubscription({
        instituteId: input.instituteId,
        planId: input.planId,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      });

      this.emitEvent('BILLING.subscription.created', {
        subscriptionId: subscription.id,
        instituteId: input.instituteId,
      });

      return { subscription, checkoutUrl: null };
    }

    const gateway = this.gatewayFactory.getForProvider(input.provider);

    const institute = await this.repo.findInstituteById(input.instituteId);

    let providerPlan: Awaited<ReturnType<typeof gateway.createPlan>>;
    let providerSub: Awaited<ReturnType<typeof gateway.createSubscription>>;
    try {
      // Create plan on provider (lazy sync)
      providerPlan = await gateway.createPlan({
        name: i18nDisplay(plan.name),
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.billingInterval as BillingInterval,
        description: i18nDisplay(plan.description) || undefined,
      });

      // Create subscription on provider
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

    // Upsert gateway config
    await this.repo.upsertGatewayConfig(input.instituteId, input.provider);

    // Create subscription record
    const subscription = await this.repo.createSubscription({
      instituteId: input.instituteId,
      planId: input.planId,
      status: 'PENDING_PAYMENT',
      providerSubscriptionId: providerSub.providerSubscriptionId,
      providerCustomerId: providerSub.providerCustomerId,
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent('BILLING.subscription.created', {
      subscriptionId: subscription.id,
      instituteId: input.instituteId,
    });

    return { subscription, checkoutUrl: providerSub.checkoutUrl };
  }

  async cancelSubscription(subscriptionId: string, atCycleEnd = true, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can('update', subject('Subscription', { instituteId: sub.instituteId }))
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (['CANCELED', 'COMPLETED'].includes(sub.status)) {
      throw new BadRequestException('Subscription is already canceled or completed');
    }

    // Free plans have no provider link — cancel immediately without gateway call
    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.instituteId);
        await gateway.cancelSubscription(sub.providerSubscriptionId, atCycleEnd);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    // atCycleEnd=true: mark canceledAt but keep current status — a scheduled job
    // (or provider webhook for paid plans) sets CANCELED when the period expires.
    // atCycleEnd=false: cancel immediately.
    const updated = atCycleEnd
      ? await this.repo.updateSubscription(subscriptionId, { canceledAt: new Date() })
      : await this.repo.updateSubscription(subscriptionId, {
          status: 'CANCELED',
          canceledAt: new Date(),
        });

    this.emitEvent('BILLING.subscription.canceled', { subscriptionId });
    return updated;
  }

  async pauseSubscription(subscriptionId: string, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can('update', subject('Subscription', { instituteId: sub.instituteId }))
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.instituteId);
        await gateway.pauseSubscription(sub.providerSubscriptionId);
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

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can('update', subject('Subscription', { instituteId: sub.instituteId }))
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'PAUSED') {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForInstitute(sub.instituteId);
        await gateway.resumeSubscription(sub.providerSubscriptionId);
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
      node: item as unknown as SubscriptionModel,
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
  }): Promise<InvoiceConnection> {
    const take = Math.min(params.first ?? 20, 100);

    const { items, totalCount } = await this.repo.findInvoices({
      instituteId: params.instituteId,
      filter: params.filter,
      first: take + 1,
      after: params.after,
      ability: params.ability,
    });

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((item) => ({
      cursor: item.id,
      node: item as unknown as InvoiceModel,
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

  async processWebhookEvent(provider: 'CASHFREE' | 'RAZORPAY', event: ProviderWebhookEvent) {
    // Atomically claim the event (unique constraint prevents duplicates)
    const claimed = await this.repo.claimPaymentEvent(event.providerEventId, {
      provider,
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
    });
    if (!claimed) return;

    const subscription = event.providerSubscriptionId
      ? await this.repo.findSubscriptionByProviderId(event.providerSubscriptionId)
      : null;

    if (subscription) {
      await this.handleSubscriptionEvent(subscription.id, event);
    }

    // Mark event as processed AFTER the handler succeeds — if the handler
    // throws, the event stays claimed but unprocessed and can be retried.
    await this.repo.markPaymentEventProcessed(event.providerEventId, {
      subscriptionId: subscription?.id,
      instituteId: subscription?.instituteId,
    });

    this.emitEvent(`BILLING.webhook.${provider.toLowerCase()}`, {
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      subscriptionId: subscription?.id,
      instituteId: subscription?.instituteId,
      provider,
    });
  }

  /**
   * Handle normalized webhook events. Both adapters normalize provider-specific
   * event types to a common vocabulary (e.g. Cashfree SUBSCRIPTION_PAYMENT_SUCCESS
   * -> "subscription.charged"), so this method is provider-agnostic.
   */
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
      case 'subscription.pending':
        await this.repo.updateSubscription(subscriptionId, { status: 'PENDING_PAYMENT' });
        break;
      case 'subscription.halted':
        await this.repo.updateSubscription(subscriptionId, { status: 'PAST_DUE' });
        break;
      case 'subscription.cancelled':
        await this.repo.updateSubscription(subscriptionId, {
          status: 'CANCELED',
          canceledAt: new Date(),
        });
        break;
      case 'subscription.completed':
        await this.repo.updateSubscription(subscriptionId, { status: 'COMPLETED' });
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

  /** Activate subscription and optionally create a PAID invoice. */
  private async activateWithInvoice(
    subscriptionId: string,
    event: ProviderWebhookEvent,
    createInvoice: boolean,
  ) {
    const sub = await this.repo.updateSubscriptionWithPlan(subscriptionId, {
      status: 'ACTIVE',
    });

    if (createInvoice && event.providerPaymentId) {
      const existing = await this.repo.findInvoiceByProviderPaymentId(event.providerPaymentId);
      if (!existing) {
        const now = new Date();
        const period = BillingPeriod.fromInterval(now, sub.plan.billingInterval as BillingInterval);

        await this.repo.createInvoice({
          subscriptionId,
          instituteId: sub.instituteId,
          amount: sub.plan.amount,
          currency: sub.plan.currency,
          status: 'PAID',
          providerPaymentId: event.providerPaymentId,
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
          paidAt: now,
          dueDate: now,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        });
      }
    }
  }
}
