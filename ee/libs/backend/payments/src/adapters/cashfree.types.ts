/**
 * Cashfree subscription webhook payload types.
 * @see https://www.cashfree.com/docs/api-reference/payments/latest/subscription/webhooks
 */

// ── Shared sub-structures ────────────────────────────────────────────────────

export interface CfCustomerDetails {
  customer_name: string | null;
  customer_email: string;
  customer_phone: string;
}

export interface CfPlanDetails {
  plan_id: string;
  plan_name: string;
  plan_type: string;
  plan_max_cycles: number;
  plan_recurring_amount: number | null;
  plan_max_amount: number;
  plan_interval_type: string | null;
  plan_intervals: number | null;
  plan_currency: string | null;
  plan_note: string | null;
  plan_status: string | null;
}

export interface CfAuthorizationDetails {
  authorization_amount: number;
  authorization_amount_refund: boolean;
  approve_by_time: string;
  authorization_reference: string | null;
  authorization_time: string;
  authorization_status: string | null;
  payment_id: string;
  payment_method: unknown;
  payment_group: string | null;
}

export interface CfPaymentGatewayDetails {
  gateway_name: string;
  gateway_subscription_id: string;
  gateway_payment_id?: string;
  gateway_plan_id?: string;
  gateway_auth_id?: string | null;
}

export interface CfSubscriptionDetails {
  cf_subscription_id: string;
  subscription_id: string;
  subscription_status: string;
  subscription_expiry_time: string;
  subscription_first_charge_time: string | null;
  subscription_tags: Record<string, string> | null;
  next_schedule_date?: string | null;
}

export interface CfFailureDetails {
  failure_reason: string | null;
}

// ── Event-specific payloads ──────────────────────────────────────────────────

export interface CfStatusChangedData {
  subscription_details: CfSubscriptionDetails;
  customer_details: CfCustomerDetails;
  plan_details: CfPlanDetails;
  authorization_details: CfAuthorizationDetails;
  payment_gateway_details: CfPaymentGatewayDetails;
}

export interface CfPaymentEventData {
  payment_id: string;
  cf_payment_id: string;
  cf_txn_id: string | null;
  cf_order_id: string;
  subscription_id: string;
  cf_subscription_id: string;
  payment_type: string;
  authorization_details: CfAuthorizationDetails;
  payment_amount: number;
  payment_currency: string;
  payment_schedule_date: string;
  payment_initiated_date: string;
  payment_remarks: string | null;
  retry_attempts: number;
  failure_details: CfFailureDetails | null;
  payment_status: string;
  payment_gateway_details: CfPaymentGatewayDetails;
}

export interface CfCardExpiryData {
  subscription_status_webhook: {
    subscription_details: CfSubscriptionDetails;
    customer_details: CfCustomerDetails;
    plan_details: CfPlanDetails;
    authorization_details: CfAuthorizationDetails;
    payment_gateway_details: CfPaymentGatewayDetails;
  };
  card_expiry_date: string;
}

// ── Top-level webhook body ───────────────────────────────────────────────────

export type CfSubscriptionEventType =
  | 'SUBSCRIPTION_STATUS_CHANGED'
  | 'SUBSCRIPTION_PAYMENT_SUCCESS'
  | 'SUBSCRIPTION_PAYMENT_FAILED'
  | 'SUBSCRIPTION_PAYMENT_CANCELLED'
  | 'SUBSCRIPTION_CARD_EXPIRY_REMINDER'
  | 'SUBSCRIPTION_AUTH_STATUS'
  | 'SUBSCRIPTION_PAYMENT_NOTIFICATION_INITIATED'
  | 'SUBSCRIPTION_REFUND_STATUS';

export interface CfWebhookBody<T = unknown> {
  type: CfSubscriptionEventType | (string & {});
  event_time: string;
  data: T;
}

/** Cashfree order-based payment webhook data (non-subscription flow) */
export interface CfOrderPaymentData {
  order_id?: string;
  cf_payment_id?: string;
  payment_amount?: number;
  payment_status?: string;
}

export type CfStatusChangedWebhook = CfWebhookBody<CfStatusChangedData>;
export type CfPaymentWebhook = CfWebhookBody<CfPaymentEventData>;
export type CfCardExpiryWebhook = CfWebhookBody<CfCardExpiryData>;
