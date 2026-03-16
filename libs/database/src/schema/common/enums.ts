import { pgEnum } from 'drizzle-orm/pg-core';

export const billingInterval = pgEnum('BillingInterval', ['MONTHLY', 'QUARTERLY', 'YEARLY']);

export const subscriptionStatus = pgEnum('SubscriptionStatus', [
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'PENDING_PAYMENT',
  'PAUSED',
  'COMPLETED',
]);

export const invoiceStatus = pgEnum('InvoiceStatus', [
  'PAID',
  'PENDING',
  'OVERDUE',
  'FAILED',
  'REFUNDED',
]);

// Domain-specific status enums — each entity owns its lifecycle
export const userStatus = pgEnum('UserStatus', ['ACTIVE', 'SUSPENDED', 'LOCKED']);
export const instituteStatus = pgEnum('InstituteStatus', ['ACTIVE', 'SUSPENDED', 'ONBOARDING']);
export const membershipStatus = pgEnum('MembershipStatus', ['ACTIVE', 'SUSPENDED', 'REVOKED']);
export const roleStatus = pgEnum('RoleStatus', ['ACTIVE', 'INACTIVE']);
export const planStatus = pgEnum('PlanStatus', ['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const gatewayConfigStatus = pgEnum('GatewayConfigStatus', ['ACTIVE', 'INACTIVE']);

export const paymentProvider = pgEnum('PaymentProvider', ['CASHFREE', 'RAZORPAY']);
