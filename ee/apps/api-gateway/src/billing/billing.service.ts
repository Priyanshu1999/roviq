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
    name: string;
    description?: string;
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    featureLimits: FeatureLimits;
  }) {
    const plan = await this.repo.createPlan({
      name: input.name,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      billingInterval: input.billingInterval,
      featureLimits: input.featureLimits,
    });

    this.emitEvent('billing.plan.created', { id: plan.id, name: plan.name });
    return plan;
  }

  async updatePlan(
    id: string,
    input: {
      name?: string;
      description?: string;
      amount?: number;
      billingInterval?: BillingInterval;
      featureLimits?: FeatureLimits;
      isActive?: boolean;
    },
  ) {
    type UpdatePlanData = Parameters<BillingRepository['updatePlan']>[1];
    const data: UpdatePlanData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.billingInterval !== undefined) data.billingInterval = input.billingInterval;
    if (input.featureLimits !== undefined) data.featureLimits = input.featureLimits;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const plan = await this.repo.updatePlan(id, data);

    this.emitEvent('billing.plan.updated', { id });
    return plan;
  }

  async findAllPlans(ability?: AppAbility) {
    return this.repo.findAllPlans(ability);
  }

  async findPlan(id: string, ability?: AppAbility) {
    const plan = await this.repo.findPlanById(id, ability);
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async assignPlanToOrganization(
    input: {
      organizationId: string;
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
      !(ability as any).can(
        'create',
        subject('Subscription', { organizationId: input.organizationId }),
      )
    ) {
      throw new ForbiddenException('Not allowed to create subscriptions for this organization');
    }

    const existing = await this.repo.findSubscriptionByOrg(input.organizationId);
    if (existing && !['CANCELED', 'COMPLETED'].includes(existing.status)) {
      throw new BadRequestException('Organization already has an active subscription');
    }

    const plan = await this.repo.findPlanById(input.planId);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    if (!plan.isActive) {
      throw new BadRequestException('Cannot assign an inactive plan');
    }

    // Free plans (amount=0) are internal-only — no gateway interaction needed
    if (plan.amount === 0) {
      const subscription = await this.repo.createSubscription({
        organizationId: input.organizationId,
        planId: input.planId,
        status: 'ACTIVE',
      });

      this.emitEvent('billing.subscription.created', {
        subscriptionId: subscription.id,
        organizationId: input.organizationId,
      });

      return { subscription, checkoutUrl: null };
    }

    const gateway = this.gatewayFactory.getForProvider(input.provider);

    const org = await this.repo.findOrganizationById(input.organizationId);

    let providerPlan: Awaited<ReturnType<typeof gateway.createPlan>>;
    let providerSub: Awaited<ReturnType<typeof gateway.createSubscription>>;
    try {
      // Create plan on provider (lazy sync)
      providerPlan = await gateway.createPlan({
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.billingInterval as BillingInterval,
        description: plan.description ?? undefined,
      });

      // Create subscription on provider
      const returnUrl = this.config.getOrThrow<string>('BILLING_RETURN_URL');
      providerSub = await gateway.createSubscription({
        providerPlanId: providerPlan.providerPlanId,
        customer: {
          name: org.name,
          email: input.customerEmail,
          phone: input.customerPhone,
        },
        returnUrl,
      });
    } catch (error) {
      this.rethrowGatewayError(error);
    }

    // Upsert gateway config
    await this.repo.upsertGatewayConfig(input.organizationId, input.provider);

    // Create subscription record
    const subscription = await this.repo.createSubscription({
      organizationId: input.organizationId,
      planId: input.planId,
      status: 'PENDING_PAYMENT',
      providerSubscriptionId: providerSub.providerSubscriptionId,
      providerCustomerId: providerSub.providerCustomerId,
    });

    this.emitEvent('billing.subscription.created', {
      subscriptionId: subscription.id,
      organizationId: input.organizationId,
    });

    return { subscription, checkoutUrl: providerSub.checkoutUrl };
  }

  async cancelSubscription(subscriptionId: string, atCycleEnd = true, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can(
        'update',
        subject('Subscription', { organizationId: sub.organizationId }),
      )
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (['CANCELED', 'COMPLETED'].includes(sub.status)) {
      throw new BadRequestException('Subscription is already canceled or completed');
    }

    // Free plans have no provider link — cancel immediately without gateway call
    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForOrganization(sub.organizationId);
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

    this.emitEvent('billing.subscription.canceled', { subscriptionId });
    return updated;
  }

  async pauseSubscription(subscriptionId: string, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can(
        'update',
        subject('Subscription', { organizationId: sub.organizationId }),
      )
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'ACTIVE') {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForOrganization(sub.organizationId);
        await gateway.pauseSubscription(sub.providerSubscriptionId);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    const updated = await this.repo.updateSubscription(subscriptionId, { status: 'PAUSED' });

    this.emitEvent('billing.subscription.paused', { subscriptionId });
    return updated;
  }

  async resumeSubscription(subscriptionId: string, ability?: AppAbility) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');

    if (
      ability &&
      // biome-ignore lint/suspicious/noExplicitAny: bridging MongoAbility subject with field conditions
      !(ability as any).can(
        'update',
        subject('Subscription', { organizationId: sub.organizationId }),
      )
    ) {
      throw new ForbiddenException('Not allowed to modify this subscription');
    }

    if (sub.status !== 'PAUSED') {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    if (sub.providerSubscriptionId) {
      try {
        const gateway = await this.gatewayFactory.getForOrganization(sub.organizationId);
        await gateway.resumeSubscription(sub.providerSubscriptionId);
      } catch (error) {
        this.rethrowGatewayError(error);
      }
    }

    const updated = await this.repo.updateSubscription(subscriptionId, { status: 'ACTIVE' });

    this.emitEvent('billing.subscription.resumed', { subscriptionId });
    return updated;
  }

  async findAllOrganizations() {
    return this.repo.findAllOrganizations();
  }

  async findSubscription(organizationId: string, ability?: AppAbility) {
    return this.repo.findSubscriptionByOrg(organizationId, ability);
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
      node: item as SubscriptionModel,
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
    organizationId?: string;
    filter?: { status?: InvoiceStatus; from?: Date; to?: Date };
    first?: number;
    after?: string;
    ability?: AppAbility;
  }): Promise<InvoiceConnection> {
    const take = Math.min(params.first ?? 20, 100);

    const { items, totalCount } = await this.repo.findInvoices({
      organizationId: params.organizationId,
      filter: params.filter,
      first: take + 1,
      after: params.after,
      ability: params.ability,
    });

    const hasNextPage = items.length > take;
    const edges = items.slice(0, take).map((item) => ({
      cursor: item.id,
      node: item as InvoiceModel,
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
      organizationId: subscription?.organizationId,
    });

    this.emitEvent(`billing.webhook.${provider.toLowerCase()}`, {
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      subscriptionId: subscription?.id,
      organizationId: subscription?.organizationId,
      provider,
    });
  }

  /**
   * Handle normalized webhook events. Both adapters normalize provider-specific
   * event types to a common vocabulary (e.g. Cashfree SUBSCRIPTION_PAYMENT_SUCCESS
   * → "subscription.charged"), so this method is provider-agnostic.
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
          organizationId: sub.organizationId,
          amount: sub.plan.amount,
          currency: sub.plan.currency,
          status: 'PAID',
          providerPaymentId: event.providerPaymentId,
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
          paidAt: now,
          dueDate: now,
        });
      }
    }
  }
}
