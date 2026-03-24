export type BillingInterval = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface CreatePlanInput {
  name: string;
  /** Amount in paise (bigint from DB). Adapters convert to provider-specific units. */
  amount: bigint;
  currency: string;
  interval: BillingInterval;
  description?: string;
}

export interface ProviderPlan {
  providerPlanId: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
}

export interface CreateSubscriptionInput {
  providerPlanId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  totalCycles?: number;
  returnUrl: string;
}

export interface ProviderSubscription {
  providerSubscriptionId: string;
  providerCustomerId?: string;
  status: string;
  checkoutUrl?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export interface ProviderPayment {
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: Date;
}

export interface ProviderRefund {
  providerRefundId: string;
  amount: number;
  status: string;
}

export interface ProviderWebhookEvent {
  eventType: string;
  providerEventId: string;
  providerSubscriptionId?: string;
  providerPaymentId?: string;
  payload: Record<string, unknown>;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly providerError?: unknown,
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

// ---------------------------------------------------------------------------
// Order-based payment types (one-time invoice payments)
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  /** Internal invoice ID */
  invoiceId: string;
  /** Amount in paise */
  amountPaise: bigint;
  currency: string;
  /** Customer details for the checkout page */
  customer: { name: string; email: string; phone: string };
  /** Where to redirect after payment */
  returnUrl: string;
  notes?: { description?: string } & Record<string, string>;
}

export interface CreateOrderResult {
  gatewayOrderId: string;
  gatewayProvider: string;
  /** Direct checkout URL (Cashfree) */
  checkoutUrl?: string;
  /** Payload for client-side SDK checkout (Razorpay) */
  checkoutPayload?: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  /** Signature from the gateway callback */
  signature: string;
}

export interface RefundInput {
  gatewayPaymentId: string;
  /** Amount in paise. Omit for full refund. */
  amountPaise?: bigint;
  reason?: string;
}

export interface RefundResult {
  gatewayRefundId: string;
  status: string;
}

export interface WebhookEvent {
  eventType: string;
  gatewayEventId: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  amountPaise?: number;
  status?: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Gateway interface
// ---------------------------------------------------------------------------

export interface PaymentGateway {
  // Subscription-based (existing)
  createPlan(params: CreatePlanInput): Promise<ProviderPlan>;
  fetchPlan(providerPlanId: string): Promise<ProviderPlan>;
  createSubscription(params: CreateSubscriptionInput): Promise<ProviderSubscription>;
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(providerSubscriptionId: string, atCycleEnd?: boolean): Promise<void>;
  pauseSubscription(providerSubscriptionId: string): Promise<void>;
  resumeSubscription(providerSubscriptionId: string): Promise<void>;
  fetchPayments(providerSubscriptionId: string): Promise<ProviderPayment[]>;
  refund(providerPaymentId: string, amount?: number): Promise<ProviderRefund>;
  verifyWebhook(headers: Record<string, string>, rawBody: string): ProviderWebhookEvent;

  // Order-based (ROV-112)
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<boolean>;
  refundOrder(input: RefundInput): Promise<RefundResult>;
  parseWebhook(body: Buffer, headers: Record<string, string>): WebhookEvent;
}
