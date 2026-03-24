export enum BillingInterval {
  /** Billed every month — most common for small/medium institutes */
  MONTHLY = 'MONTHLY',
  /** Billed every 3 months — slight discount over monthly */
  QUARTERLY = 'QUARTERLY',
  /** Billed every 6 months — mid-term commitment discount */
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  /** Billed once per year — maximum discount for annual commitment */
  ANNUAL = 'ANNUAL',
}

export enum SubscriptionStatus {
  /** Institute is in free trial period — can use all features, no payment yet */
  TRIALING = 'TRIALING',
  /** Subscription is paid and active — full feature access */
  ACTIVE = 'ACTIVE',
  /** Reseller manually paused the subscription — institute may have limited access */
  PAUSED = 'PAUSED',
  /** Payment failed — 7-day grace period before cancellation */
  PAST_DUE = 'PAST_DUE',
  /** Subscription terminated by reseller or due to non-payment — institute suspended */
  CANCELLED = 'CANCELLED',
  /** Trial ended without conversion to paid — institute suspended */
  EXPIRED = 'EXPIRED',
}

export enum InvoiceStatus {
  /** Invoice created but not yet sent to institute */
  DRAFT = 'DRAFT',
  /** Invoice sent to institute — awaiting payment */
  SENT = 'SENT',
  /** Invoice fully paid — totalAmount <= paidAmount */
  PAID = 'PAID',
  /** Partial payment received — paidAmount < totalAmount */
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  /** Payment past due date — escalation triggers may apply */
  OVERDUE = 'OVERDUE',
  /** Invoice cancelled before payment — no amount owed */
  CANCELLED = 'CANCELLED',
  /** Full refund issued — paidAmount returned to institute */
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  /** Payment initiated but not yet confirmed by gateway */
  PENDING = 'PENDING',
  /** Gateway is processing the payment */
  PROCESSING = 'PROCESSING',
  /** Payment confirmed and funds received */
  SUCCEEDED = 'SUCCEEDED',
  /** Payment attempt failed — institute may retry */
  FAILED = 'FAILED',
  /** Full refund processed — original amount returned */
  REFUNDED = 'REFUNDED',
  /** Partial refund processed — some amount returned */
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentMethod {
  /** Online payment via Razorpay gateway */
  RAZORPAY = 'RAZORPAY',
  /** Online payment via Cashfree gateway */
  CASHFREE = 'CASHFREE',
  /** Direct UPI transfer (manual recording by reseller) */
  UPI = 'UPI',
  /** Bank transfer / NEFT / RTGS (manual recording by reseller) */
  BANK_TRANSFER = 'BANK_TRANSFER',
  /** Cash payment at office (manual recording by reseller) */
  CASH = 'CASH',
  /** Cheque payment (manual recording by reseller) */
  CHEQUE = 'CHEQUE',
}

export enum PlanStatus {
  /** Plan is available for new subscriptions and visible in pricing catalog */
  ACTIVE = 'ACTIVE',
  /** Plan is hidden from catalog — existing subscriptions unaffected */
  INACTIVE = 'INACTIVE',
}

export enum PaymentProvider {
  /** Razorpay — primary Indian payment gateway (supports UPI, cards, netbanking) */
  RAZORPAY = 'RAZORPAY',
  /** Cashfree — alternative Indian payment gateway */
  CASHFREE = 'CASHFREE',
}

export enum GatewayConfigStatus {
  /** Gateway config is active and available for processing payments */
  ACTIVE = 'ACTIVE',
  /** Gateway config is disabled — no new payments will be processed through it */
  INACTIVE = 'INACTIVE',
}

export interface FeatureLimits {
  maxStudents: number | null;
  maxStaff: number | null;
  maxStorageMb: number | null;
  auditLogRetentionDays: number;
  features: string[];
}
