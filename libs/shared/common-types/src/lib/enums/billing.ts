/**
 * Billing-domain enums — single source of truth.
 *
 * Consumed by:
 *   - `libs/ee/database` → `pgEnum(...)` column types
 *   - `apps/ee/api-gateway` → `registerEnumType(...)` + `@IsEnum(...)` + `@Field(() => ...)`
 *   - `apps/web` → Zod schemas, Select options, runtime comparisons
 */

// ─── SubscriptionStatus ───────────────────────────────────────────────────────

export const SUBSCRIPTION_STATUS_VALUES = [
  // Institute is in free trial period — can use all features, no payment yet
  'TRIALING',
  // Subscription is paid and active — full feature access
  'ACTIVE',
  // Reseller manually paused the subscription — institute may have limited access
  'PAUSED',
  // Payment failed — grace period before cancellation
  'PAST_DUE',
  // Subscription terminated by reseller or due to non-payment — institute suspended
  'CANCELLED',
  // Trial ended without conversion to paid — institute suspended
  'EXPIRED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const SubscriptionStatus = Object.fromEntries(
  SUBSCRIPTION_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in SubscriptionStatus]: K };

// ─── InvoiceStatus ────────────────────────────────────────────────────────────

export const INVOICE_STATUS_VALUES = [
  // Invoice created but not yet sent to institute
  'DRAFT',
  // Invoice sent to institute — awaiting payment
  'SENT',
  // Invoice fully paid
  'PAID',
  // Partial payment received
  'PARTIALLY_PAID',
  // Payment past due date — escalation triggers may apply
  'OVERDUE',
  // Invoice voided; no payment expected
  'CANCELLED',
  // Payment reversed — amount returned to institute, no longer counts as revenue
  'REFUNDED',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUS_VALUES)[number];

export const InvoiceStatus = Object.fromEntries(INVOICE_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in InvoiceStatus]: K;
};

// ─── PlanStatus ───────────────────────────────────────────────────────────────

export const PLAN_STATUS_VALUES = [
  // Plan is available for new subscriptions and visible in pricing catalog
  'ACTIVE',
  // Plan is hidden from catalog — existing subscriptions unaffected
  'INACTIVE',
] as const;

export type PlanStatus = (typeof PLAN_STATUS_VALUES)[number];

export const PlanStatus = Object.fromEntries(PLAN_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in PlanStatus]: K;
};
