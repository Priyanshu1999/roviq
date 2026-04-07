import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
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
import type {
  CfCardExpiryWebhook,
  CfOrderPaymentData,
  CfPaymentWebhook,
  CfStatusChangedWebhook,
  CfWebhookBody,
} from './cashfree.types';

const CF_INTERVAL_MAP: Record<BillingInterval, string> = {
  MONTHLY: 'MONTH',
  QUARTERLY: 'MONTH',
  SEMI_ANNUAL: 'MONTH',
  ANNUAL: 'YEAR',
};

const CF_INTERVAL_COUNT: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 1,
};

function cashfreeErrorDetail(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    return typeof message === 'string' ? message : error.message;
  }
  if (error instanceof Error) return error.message;
  return '';
}

export class CashfreeAdapter implements PaymentGateway {
  private readonly client: InstanceType<typeof Cashfree>;

  constructor(config: ConfigService) {
    const env =
      config.getOrThrow('CASHFREE_ENVIRONMENT') === 'PRODUCTION'
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;
    this.client = new Cashfree(
      env,
      config.getOrThrow('CASHFREE_CLIENT_ID'),
      config.getOrThrow('CASHFREE_CLIENT_SECRET'),
    );
    this.client.XApiVersion = config.getOrThrow('CASHFREE_API_VERSION');
  }

  async createPlan(params: CreatePlanInput): Promise<ProviderPlan> {
    try {
      // Cashfree expects amount in rupees (whole units), not paise
      const amountRupees = Math.round(Number(params.amount) / 100);
      const response = await this.client.SubsCreatePlan({
        plan_id: `p_${randomUUID()}`,
        plan_name: params.name,
        plan_type: 'PERIODIC',
        plan_currency: params.currency,
        plan_recurring_amount: amountRupees,
        plan_max_amount: amountRupees,
        plan_intervals: CF_INTERVAL_COUNT[params.interval] ?? 1,
        plan_interval_type: CF_INTERVAL_MAP[params.interval] ?? 'MONTH',
        plan_note: params.description ?? '',
      });
      const data = response?.data;
      return {
        providerPlanId: data?.plan_id ?? '',
        name: data?.plan_name ?? params.name,
        amount: Number(params.amount),
        currency: params.currency,
        interval: params.interval,
      };
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to create plan on Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async fetchPlan(providerPlanId: string): Promise<ProviderPlan> {
    try {
      const response = await this.client.SubsFetchPlan(providerPlanId);
      const data = response?.data;
      return {
        providerPlanId: data?.plan_id ?? providerPlanId,
        name: data?.plan_name ?? '',
        amount: Math.round((data?.plan_recurring_amount ?? 0) * 100),
        currency: data?.plan_currency ?? 'INR',
        interval: data?.plan_interval_type ?? '',
      };
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch plan from Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async createSubscription(params: CreateSubscriptionInput): Promise<ProviderSubscription> {
    try {
      const subscriptionId = `s_${randomUUID()}`;
      const response = await this.client.SubsCreateSubscription({
        subscription_id: subscriptionId,
        customer_details: {
          customer_name: params.customer.name,
          customer_email: params.customer.email,
          customer_phone: params.customer.phone,
        },
        plan_details: {
          plan_id: params.providerPlanId,
        },
        authorization_details: {
          authorization_amount: 1,
          authorization_amount_refund: true,
        },
        subscription_meta: {
          return_url: params.returnUrl,
        },
      });
      const data = response?.data;
      return {
        providerSubscriptionId: data?.subscription_id ?? subscriptionId,
        providerCustomerId: data?.cf_subscription_id,
        status: data?.subscription_status ?? 'INITIALIZED',
        checkoutUrl: data?.subscription_session_id
          ? `https://payments.cashfree.com/subscription/pay/${data.subscription_session_id}`
          : undefined,
      };
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to create subscription on Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      const response = await this.client.SubsFetchSubscription(providerSubscriptionId);
      const data = response?.data;
      return {
        providerSubscriptionId: data?.subscription_id ?? providerSubscriptionId,
        providerCustomerId: data?.cf_subscription_id,
        status: data?.subscription_status ?? '',
      };
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch subscription from Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  // Cashfree does not support cancel-at-cycle-end — cancellation is always immediate.
  async cancelSubscription(providerSubscriptionId: string, _atCycleEnd?: boolean): Promise<void> {
    try {
      await this.client.SubsManageSubscription(providerSubscriptionId, {
        subscription_id: providerSubscriptionId,
        action: 'CANCEL',
      });
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to cancel subscription on Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async pauseSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.client.SubsManageSubscription(providerSubscriptionId, {
        subscription_id: providerSubscriptionId,
        action: 'PAUSE',
      });
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to pause subscription on Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async resumeSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.client.SubsManageSubscription(providerSubscriptionId, {
        subscription_id: providerSubscriptionId,
        action: 'ACTIVATE',
      });
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to resume subscription on Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async fetchPayments(providerSubscriptionId: string): Promise<ProviderPayment[]> {
    try {
      const response = await this.client.SubsFetchSubscriptionPayments(providerSubscriptionId);
      const items = response?.data ?? [];
      return items.map((p) => ({
        providerPaymentId: p.cf_payment_id ?? '',
        amount: Math.round((p.payment_amount ?? 0) * 100),
        currency: 'INR',
        status: p.payment_status ?? '',
        paidAt: p.payment_initiated_date ? new Date(p.payment_initiated_date) : undefined,
      }));
    } catch (error) {
      const detail = cashfreeErrorDetail(error);
      throw new PaymentGatewayError(
        `Failed to fetch payments from Cashfree${detail ? `: ${detail}` : ''}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async refund(_providerPaymentId: string, _amount?: number): Promise<ProviderRefund> {
    // Cashfree's SubsCreateRefund expects a subscription_id as its first argument,
    // but the shared PaymentGateway interface only passes providerPaymentId.
    // The interface must be updated to include subscriptionId before this can work.
    throw new PaymentGatewayError(
      'Cashfree refund is not yet implemented — PaymentGateway interface needs subscriptionId parameter',
      'CASHFREE',
    );
  }

  // ---------------------------------------------------------------------------
  // Order-based (ROV-112)
  // ---------------------------------------------------------------------------

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    try {
      const orderId = `ord_${randomUUID()}`;
      const response = await this.client.PGCreateOrder({
        order_id: orderId,
        order_amount: Number(input.amountPaise) / 100,
        order_currency: input.currency,
        customer_details: {
          customer_id: input.invoiceId,
          customer_name: input.customer.name,
          customer_email: input.customer.email,
          customer_phone: input.customer.phone,
        },
        order_meta: { return_url: input.returnUrl },
        order_note: input.notes?.description ?? undefined,
      });
      const data = response?.data;
      return {
        gatewayOrderId: data?.cf_order_id?.toString() ?? orderId,
        gatewayProvider: 'CASHFREE',
        checkoutUrl: data?.payment_session_id
          ? `https://payments.cashfree.com/order/#${data.payment_session_id}`
          : undefined,
        checkoutPayload: { paymentSessionId: data?.payment_session_id },
      };
    } catch (error) {
      throw new PaymentGatewayError(
        `Failed to create order: ${cashfreeErrorDetail(error)}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<boolean> {
    try {
      const response = await this.client.PGFetchOrder(input.gatewayOrderId);
      const status = response?.data?.order_status;
      return status === 'PAID';
    } catch {
      return false;
    }
  }

  async refundOrder(input: RefundInput): Promise<RefundResult> {
    try {
      const response = await this.client.PGOrderCreateRefund(input.gatewayPaymentId, {
        refund_id: `ref_${randomUUID()}`,
        refund_amount: input.amountPaise ? Number(input.amountPaise) / 100 : 0,
        refund_note: input.reason ?? 'Refund',
      });
      const data = response?.data;
      return {
        gatewayRefundId: data?.cf_refund_id?.toString() ?? '',
        status: data?.refund_status ?? 'PENDING',
      };
    } catch (error) {
      throw new PaymentGatewayError(
        `Failed to refund: ${cashfreeErrorDetail(error)}`,
        'CASHFREE',
        undefined,
        error,
      );
    }
  }

  parseWebhook(body: Buffer, headers: Record<string, string>): WebhookEvent {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!signature || !timestamp) {
      throw new PaymentGatewayError('Missing webhook signature or timestamp', 'CASHFREE');
    }

    const rawBody = body.toString();
    try {
      this.client.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch {
      throw new PaymentGatewayError('Invalid webhook signature', 'CASHFREE');
    }

    const parsed = JSON.parse(rawBody) as CfWebhookBody<CfOrderPaymentData>;
    const paymentData = parsed.data;
    const amount = paymentData?.payment_amount;
    return {
      eventType: parsed.type ?? 'unknown',
      gatewayEventId: `cf_${parsed.type ?? 'unknown'}_${randomUUID()}`,
      gatewayOrderId: paymentData?.order_id,
      gatewayPaymentId: paymentData?.cf_payment_id,
      amountPaise: amount ? Math.round(Number(amount) * 100) : undefined,
      status: paymentData?.payment_status,
      payload: { ...parsed },
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): ProviderWebhookEvent {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!signature || !timestamp) {
      throw new PaymentGatewayError('Missing webhook signature or timestamp headers', 'CASHFREE');
    }

    try {
      this.client.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch {
      throw new PaymentGatewayError('Invalid webhook signature', 'CASHFREE');
    }

    const body = JSON.parse(rawBody) as CfWebhookBody;
    const ids = extractCashfreeIds(body);

    return {
      eventType: normalizeCashfreeEventType(body),
      providerEventId:
        ids.paymentId ?? ids.subscriptionId ?? `cf_${body.type ?? 'unknown'}_${randomUUID()}`,
      providerSubscriptionId: ids.subscriptionId,
      providerPaymentId: ids.paymentId,
      payload: { ...body },
    };
  }
}

/**
 * Extract subscription and payment IDs from Cashfree webhook payloads.
 * Field paths differ by event type:
 * - Payment events: flat under `data.*`
 * - Status changed: under `data.subscription_details.*`
 * - Card expiry: under `data.subscription_status_webhook.subscription_details.*`
 */
function extractCashfreeIds(body: CfWebhookBody): {
  subscriptionId?: string;
  paymentId?: string;
} {
  const rawType = body.type ?? '';

  if (isPaymentEvent(rawType)) {
    const data = body.data as CfPaymentWebhook['data'];
    return {
      subscriptionId: data?.subscription_id,
      paymentId: data?.cf_payment_id,
    };
  }

  if (rawType === 'SUBSCRIPTION_STATUS_CHANGED') {
    const data = body.data as CfStatusChangedWebhook['data'];
    return { subscriptionId: data?.subscription_details?.subscription_id };
  }

  if (rawType === 'SUBSCRIPTION_CARD_EXPIRY_REMINDER') {
    const data = body.data as CfCardExpiryWebhook['data'];
    return {
      subscriptionId: data?.subscription_status_webhook?.subscription_details?.subscription_id,
    };
  }

  return {};
}

function isPaymentEvent(type: string): boolean {
  return (
    type === 'SUBSCRIPTION_PAYMENT_SUCCESS' ||
    type === 'SUBSCRIPTION_PAYMENT_FAILED' ||
    type === 'SUBSCRIPTION_PAYMENT_CANCELLED'
  );
}

const CF_STATUS_TO_EVENT: Record<string, string> = {
  ACTIVE: 'subscription.activated',
  CUSTOMER_CANCELLED: 'subscription.cancelled',
  CANCELLED: 'subscription.cancelled',
  CUSTOMER_PAUSED: 'subscription.paused',
  ON_HOLD: 'subscription.halted',
  CARD_EXPIRED: 'subscription.halted',
  COMPLETED: 'subscription.completed',
  EXPIRED: 'subscription.completed',
  LINK_EXPIRED: 'subscription.completed',
  BANK_APPROVAL_PENDING: 'subscription.pending',
};

const CF_EVENT_TYPE_MAP: Record<string, string> = {
  SUBSCRIPTION_PAYMENT_SUCCESS: 'subscription.charged',
  SUBSCRIPTION_PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_PAYMENT_CANCELLED: 'payment.cancelled',
  SUBSCRIPTION_CARD_EXPIRY_REMINDER: 'subscription.card_expiry_reminder',
};

/** Normalize Cashfree event types to provider-agnostic vocabulary. */
function normalizeCashfreeEventType(body: CfWebhookBody): string {
  const rawType = body.type ?? '';

  if (rawType === 'SUBSCRIPTION_STATUS_CHANGED') {
    const data = body.data as CfStatusChangedWebhook['data'];
    const subStatus = data?.subscription_details?.subscription_status ?? '';
    return (
      CF_STATUS_TO_EVENT[subStatus] ?? `subscription.status_changed.${subStatus.toLowerCase()}`
    );
  }

  return CF_EVENT_TYPE_MAP[rawType] ?? rawType;
}
