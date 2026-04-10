import { createHmac } from 'node:crypto';

/**
 * Simulates a payment gateway webhook by POSTing directly to the webhook
 * controller endpoint with a valid HMAC signature. No external gateway needed.
 *
 * The webhook controller (`ee/apps/api-gateway/src/billing/webhook/`) calls
 * `RazorpayAdapter.parseWebhook()` / `CashfreeAdapter.parseWebhook()`, which
 * verify signatures against `RAZORPAY_WEBHOOK_SECRET` / `CASHFREE_*_SECRET`.
 * The same secret value used by the running api-gateway must be passed in
 * via `webhookSecret` (defaulting to `process.env.RAZORPAY_WEBHOOK_SECRET`,
 * which mirrors the value in `.env`).
 *
 * Endpoints:
 *   POST /api/webhooks/razorpay/:resellerId
 *   POST /api/webhooks/cashfree/:resellerId
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3004/api/graphql';
// Strip the trailing `/graphql` (or `/graphql/`) to get the API base.
const API_BASE = API_URL.replace(/\/graphql\/?$/, '');

export type SimulatedPaymentStatus = 'captured' | 'failed' | 'refunded';

export interface SimulatePaymentWebhookOptions {
  resellerId: string;
  invoiceId: string;
  tenantId: string;
  amountPaise: number;
  status: SimulatedPaymentStatus;
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  /** Defaults to 'razorpay'. */
  gateway?: 'razorpay' | 'cashfree';
  /**
   * Webhook signing secret. Defaults to `process.env.RAZORPAY_WEBHOOK_SECRET`
   * (or `CASHFREE_WEBHOOK_SECRET`) — must match the api-gateway's running config.
   */
  webhookSecret?: string;
}

export interface SimulatedWebhookResult {
  status: number;
  body: unknown;
}

/**
 * Build a Razorpay webhook event body shaped like the real Razorpay payload.
 * The adapter only reads `event` + `payload.payment.entity.{id, order_id, amount, status}`,
 * so we keep the body minimal.
 */
function buildRazorpayBody(options: SimulatePaymentWebhookOptions): string {
  const { status, invoiceId, tenantId, amountPaise, gatewayPaymentId, gatewayOrderId } = options;
  const eventType =
    status === 'captured'
      ? 'payment.captured'
      : status === 'failed'
        ? 'payment.failed'
        : 'refund.processed';

  const body = {
    entity: 'event',
    account_id: 'acc_test',
    event: eventType,
    contains: ['payment'],
    created_at: Math.floor(Date.now() / 1000),
    // Top-level metadata read by RazorpayWebhookController as `payload.invoiceId`/`payload.tenantId`
    invoiceId,
    tenantId,
    payload: {
      payment: {
        entity: {
          id: gatewayPaymentId,
          entity: 'payment',
          amount: amountPaise,
          currency: 'INR',
          status,
          order_id: gatewayOrderId ?? `order_${gatewayPaymentId}`,
          invoice_id: null,
          method: 'card',
          captured: status === 'captured',
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
  };
  return JSON.stringify(body);
}

/**
 * Build a Cashfree webhook body. The Cashfree adapter parses a different
 * shape than Razorpay; this is a minimal envelope matching the fields the
 * adapter reads. Refer to ee/libs/backend/payments/src/adapters/cashfree.* for
 * the exact contract before relying on this in tests.
 */
function buildCashfreeBody(options: SimulatePaymentWebhookOptions): string {
  const { status, invoiceId, tenantId, amountPaise, gatewayPaymentId, gatewayOrderId } = options;
  const cfStatus = status === 'captured' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : 'REFUNDED';
  const body = {
    type: status === 'refunded' ? 'REFUND_STATUS_WEBHOOK' : 'PAYMENT_SUCCESS_WEBHOOK',
    invoiceId,
    tenantId,
    data: {
      order: {
        order_id: gatewayOrderId ?? `order_${gatewayPaymentId}`,
        order_amount: amountPaise / 100,
      },
      payment: {
        cf_payment_id: gatewayPaymentId,
        payment_status: cfStatus,
        payment_amount: amountPaise / 100,
        payment_currency: 'INR',
      },
    },
  };
  return JSON.stringify(body);
}

function signRazorpay(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function signCashfree(rawBody: string, secret: string, timestamp: string): string {
  // Cashfree v3 webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secret))
  return createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('base64');
}

/**
 * POST a signed webhook payload to the running api-gateway. Returns the raw
 * HTTP status and parsed JSON body so callers can assert success and inspect
 * any error response.
 */
export async function simulatePaymentWebhook(
  options: SimulatePaymentWebhookOptions,
): Promise<SimulatedWebhookResult> {
  const gateway = options.gateway ?? 'razorpay';
  const url = `${API_BASE}/webhooks/${gateway}/${options.resellerId}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  let body: string;
  if (gateway === 'razorpay') {
    const secret = options.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? 'placeholder';
    body = buildRazorpayBody(options);
    headers['x-razorpay-signature'] = signRazorpay(body, secret);
  } else {
    const secret = options.webhookSecret ?? process.env.CASHFREE_WEBHOOK_SECRET ?? 'placeholder';
    const timestamp = String(Math.floor(Date.now() / 1000));
    body = buildCashfreeBody(options);
    headers['x-webhook-timestamp'] = timestamp;
    headers['x-webhook-signature'] = signCashfree(body, secret, timestamp);
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  let parsed: unknown;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
