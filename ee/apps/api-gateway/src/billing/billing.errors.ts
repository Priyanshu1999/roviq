import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Machine-readable billing error codes.
 * Each code maps to a specific HTTP status and domain scenario.
 */
export const BillingErrorCode = {
  /** Plan not found or soft-deleted */
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  /** Subscription not found */
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  /** Invoice not found */
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  /** Payment record not found */
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  /** Gateway config not found or deleted */
  GATEWAY_CONFIG_NOT_FOUND: 'GATEWAY_CONFIG_NOT_FOUND',
  /** Cannot delete/archive plan with active subscriptions */
  PLAN_IN_USE: 'PLAN_IN_USE',
  /** Plan code already exists for this reseller */
  PLAN_CODE_DUPLICATE: 'PLAN_CODE_DUPLICATE',
  /** Institute already has an active/trialing/paused subscription */
  SUBSCRIPTION_EXISTS: 'SUBSCRIPTION_EXISTS',
  /** Subscription is in a terminal state (cancelled/expired) — no further mutations */
  SUBSCRIPTION_TERMINAL: 'SUBSCRIPTION_TERMINAL',
  /** Invoice has already been fully paid */
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  /** Invoice status does not allow payment (draft, cancelled, refunded) */
  INVOICE_NOT_PAYABLE: 'INVOICE_NOT_PAYABLE',
  /** Payment signature/hash verification failed */
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  /** No active gateway config for this reseller+provider */
  GATEWAY_NOT_CONFIGURED: 'GATEWAY_NOT_CONFIGURED',
  /** Payment gateway returned an error */
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  /** Refund amount exceeds total paid amount */
  REFUND_EXCEEDS_PAID: 'REFUND_EXCEEDS_PAID',
  /** Optimistic lock failed — entity was modified by another request */
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  /** UTR number format is invalid or doesn't match expected pattern */
  UTR_INVALID: 'UTR_INVALID',
  /** A payment with this UTR number has already been submitted */
  UTR_ALREADY_SUBMITTED: 'UTR_ALREADY_SUBMITTED',
} as const;

export type BillingErrorCode = (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

/** Throw a billing-specific error with machine-readable code in GraphQL extensions */
export function billingError(code: BillingErrorCode, message: string): never {
  const ExceptionClass = ERROR_STATUS_MAP[code];
  const error = new ExceptionClass(message);
  // NestJS GraphQL maps originalError.extensions to GraphQL error extensions
  Object.defineProperty(error, 'extensions', { value: { code }, enumerable: true });
  throw error;
}

const ERROR_STATUS_MAP: Record<BillingErrorCode, new (msg: string) => Error> = {
  PLAN_NOT_FOUND: NotFoundException,
  SUBSCRIPTION_NOT_FOUND: NotFoundException,
  INVOICE_NOT_FOUND: NotFoundException,
  PAYMENT_NOT_FOUND: NotFoundException,
  GATEWAY_CONFIG_NOT_FOUND: NotFoundException,
  PLAN_IN_USE: ConflictException,
  PLAN_CODE_DUPLICATE: ConflictException,
  SUBSCRIPTION_EXISTS: ConflictException,
  SUBSCRIPTION_TERMINAL: UnprocessableEntityException,
  INVOICE_ALREADY_PAID: ConflictException,
  INVOICE_NOT_PAYABLE: UnprocessableEntityException,
  PAYMENT_VERIFICATION_FAILED: UnprocessableEntityException,
  GATEWAY_NOT_CONFIGURED: UnprocessableEntityException,
  GATEWAY_ERROR: BadGatewayException,
  REFUND_EXCEEDS_PAID: UnprocessableEntityException,
  CONCURRENT_MODIFICATION: ConflictException,
  UTR_INVALID: BadRequestException,
  UTR_ALREADY_SUBMITTED: ConflictException,
};
