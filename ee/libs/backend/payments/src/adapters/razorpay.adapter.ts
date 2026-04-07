import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import type { INormalizeError } from 'razorpay/dist/types/api';
import type { Orders } from 'razorpay/dist/types/orders';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import type {
  BillingInterval,
  CreateOrderInput,
  CreateOrderResult,
  CreatePlanInput,
  CreateSubscriptionInput,
  PaymentGateway,
  ProviderPayment,
  ProviderPlan,
  ProviderRefund,
  ProviderSubscription,
  ProviderWebhookEvent,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
  WebhookEvent,
} from '../ports/payment-gateway.port';
import { PaymentGatewayError } from '../ports/payment-gateway.port';
import type { RazorpayWebhookBody } from './razorpay.types';

const INTERVAL_MAP: Record<BillingInterval, 'daily' | 'weekly' | 'monthly' | 'yearly'> = {
  MONTHLY: 'monthly',
  QUARTERLY: 'monthly',
  SEMI_ANNUAL: 'monthly',
  ANNUAL: 'yearly',
};

const INTERVAL_COUNT: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 1,
};

function isRazorpayError(error: unknown): error is INormalizeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as INormalizeError).error === 'object'
  );
}

function razorpayErrorDetail(error: unknown): string {
  if (isRazorpayError(error)) return error.error.description ?? '';
  if (error instanceof Error) return error.message;
  return '';
}

export class RazorpayAdapter implements PaymentGateway {
  private readonly instance: InstanceType<typeof Razorpay>;
  private readonly webhookSecret: string;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(config: ConfigService) {
    this.keyId = config.getOrThrow('RAZORPAY_KEY_ID');
    this.keySecret = config.getOrThrow('RAZORPAY_KEY_SECRET');
    this.instance = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
    this.webhookSecret = config.getOrThrow('RAZORPAY_WEBHOOK_SECRET');
  }

  async createPlan(params: CreatePlanInput): Promise<ProviderPlan> {
    try {
      // Razorpay expects amount in paise as number
      const amountPaise = Number(params.amount);
      const result = await this.instance.plans.create({
        period: INTERVAL_MAP[params.interval] ?? 'monthly',
        interval: INTERVAL_COUNT[params.interval] ?? 1,
        item: {
          name: params.name,
          amount: amountPaise,
          currency: params.currency,
          description: params.description ?? '',
        },
      });
      return {
        providerPlanId: result.id,
        name: params.name,
        amount: amountPaise,
        currency: params.currency,
        interval: params.interval,
      };
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to create plan on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async fetchPlan(providerPlanId: string): Promise<ProviderPlan> {
    try {
      const result = await this.instance.plans.fetch(providerPlanId);
      return {
        providerPlanId: result.id,
        name: result.item?.name ?? '',
        amount: Number(result.item?.amount ?? 0),
        currency: result.item?.currency ?? 'INR',
        interval: result.period ?? '',
      };
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch plan from Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async createSubscription(params: CreateSubscriptionInput): Promise<ProviderSubscription> {
    try {
      const result = await this.instance.subscriptions.create({
        plan_id: params.providerPlanId,
        total_count: params.totalCycles ?? 12,
        customer_notify: true,
        notes: {
          return_url: params.returnUrl,
        },
      });
      return {
        providerSubscriptionId: result.id,
        status: result.status,
        checkoutUrl: result.short_url,
      };
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to create subscription on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      const result = await this.instance.subscriptions.fetch(providerSubscriptionId);
      return {
        providerSubscriptionId: result.id,
        status: result.status,
        currentPeriodStart: result.current_start
          ? new Date(result.current_start * 1000)
          : undefined,
        currentPeriodEnd: result.current_end ? new Date(result.current_end * 1000) : undefined,
      };
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch subscription from Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async cancelSubscription(providerSubscriptionId: string, atCycleEnd = false): Promise<void> {
    try {
      await this.instance.subscriptions.cancel(providerSubscriptionId, atCycleEnd);
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to cancel subscription on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async pauseSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.instance.subscriptions.pause(providerSubscriptionId, { pause_at: 'now' });
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to pause subscription on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async resumeSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.instance.subscriptions.resume(providerSubscriptionId, { resume_at: 'now' });
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to resume subscription on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async fetchPayments(providerSubscriptionId: string): Promise<ProviderPayment[]> {
    try {
      const result = await this.instance.invoices.all({
        subscription_id: providerSubscriptionId,
      });
      const items = result.items ?? [];
      return items.map((inv) => ({
        providerPaymentId: String(inv.payment_id ?? inv.id ?? ''),
        amount: Number(inv.amount ?? 0),
        currency: String(inv.currency ?? 'INR'),
        status: String(inv.status ?? ''),
        paidAt: inv.paid_at ? new Date(Number(inv.paid_at) * 1000) : undefined,
      }));
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch payments from Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async refund(providerPaymentId: string, amount?: number): Promise<ProviderRefund> {
    if (amount !== undefined && amount <= 0) {
      throw new Error('Refund amount must be a positive number');
    }
    try {
      const result = await this.instance.payments.refund(providerPaymentId, {
        ...(amount !== undefined && { amount }),
      });
      return {
        providerRefundId: result.id,
        amount: Number(result.amount ?? 0),
        status: result.status,
      };
    } catch (error) {
      const detail = razorpayErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to create refund on Razorpay${detail ? `: ${detail}` : ''}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Order-based (ROV-112)
  // ---------------------------------------------------------------------------

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    try {
      const result: Orders.RazorpayOrder = await this.instance.orders.create({
        amount: Number(input.amountPaise),
        currency: input.currency,
        receipt: input.invoiceId,
        notes: input.notes ?? {},
      });
      return {
        gatewayOrderId: result.id,
        gatewayProvider: 'RAZORPAY',
        checkoutPayload: {
          key: this.keyId,
          order_id: result.id,
          amount: result.amount,
          currency: result.currency,
          name: input.customer.name,
          prefill: { email: input.customer.email, contact: input.customer.phone },
          callback_url: input.returnUrl,
        },
      };
    } catch (error) {
      throw new PaymentGatewayError(
        `Failed to create order: ${razorpayErrorDetail(error)}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<boolean> {
    try {
      const body = `${input.gatewayOrderId}|${input.gatewayPaymentId}`;
      return validateWebhookSignature(body, input.signature, this.keySecret ?? '');
    } catch {
      return false;
    }
  }

  async refundOrder(input: RefundInput): Promise<RefundResult> {
    try {
      const result = await this.instance.payments.refund(input.gatewayPaymentId, {
        ...(input.amountPaise !== undefined && { amount: Number(input.amountPaise) }),
        ...(input.reason && { notes: { reason: input.reason } }),
      });
      return { gatewayRefundId: result.id, status: result.status };
    } catch (error) {
      throw new PaymentGatewayError(
        `Failed to refund: ${razorpayErrorDetail(error)}`,
        'RAZORPAY',
        undefined,
        error,
      );
    }
  }

  parseWebhook(body: Buffer, headers: Record<string, string>): WebhookEvent {
    const signature = headers['x-razorpay-signature'];
    if (!signature) throw new PaymentGatewayError('Missing x-razorpay-signature', 'RAZORPAY');

    const rawBody = body.toString();
    const isValid = validateWebhookSignature(rawBody, signature, this.webhookSecret);
    if (!isValid) throw new PaymentGatewayError('Invalid webhook signature', 'RAZORPAY');

    const parsed = JSON.parse(rawBody) as RazorpayWebhookBody;
    const payment = parsed.payload.payment?.entity;
    return {
      eventType: parsed.event,
      gatewayEventId: `rzp_${parsed.event}_${payment?.id ?? randomUUID()}`,
      gatewayOrderId: payment?.order_id as string | undefined,
      gatewayPaymentId: payment?.id,
      amountPaise: payment?.amount ? Number(payment.amount) : undefined,
      status: payment?.status as string | undefined,
      payload: { ...parsed },
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): ProviderWebhookEvent {
    const signature = headers['x-razorpay-signature'];
    if (!signature) {
      throw new PaymentGatewayError('Missing x-razorpay-signature header', 'RAZORPAY');
    }

    const isValid = validateWebhookSignature(rawBody, signature, this.webhookSecret);
    if (!isValid) {
      throw new PaymentGatewayError('Invalid webhook signature', 'RAZORPAY');
    }

    const body = JSON.parse(rawBody) as RazorpayWebhookBody;
    const entityId = body.payload.payment?.entity.id ?? body.payload.subscription?.entity.id;
    return {
      eventType: normalizeRazorpayEventType(body.event),
      providerEventId: entityId ? `${body.event}_${entityId}` : `rzp_${body.event}_${randomUUID()}`,
      providerSubscriptionId: body.payload.subscription?.entity.id,
      providerPaymentId: body.payload.payment?.entity.id,
      payload: { ...body },
    };
  }
}

/**
 * Razorpay event names already match the normalized vocabulary
 * (e.g. "subscription.charged", "subscription.halted", "payment.captured").
 * This pass-through exists to make the normalization contract explicit
 * and provide a single place to add mappings if Razorpay changes names.
 */
const RZP_EVENT_MAP: Record<string, string> = {
  // No overrides needed — Razorpay names are the canonical format.
  // Add entries here if Razorpay introduces new event names that differ
  // from the normalized vocabulary used in BillingService.
};

function normalizeRazorpayEventType(event: string): string {
  return RZP_EVENT_MAP[event] ?? event;
}
