import { pgEnum } from 'drizzle-orm/pg-core';

export const planStatus = pgEnum('PlanStatus', [
  // Plan is available for new subscriptions and visible in the pricing catalog
  'ACTIVE',
  // Plan retired — hidden from new subscriptions, existing subscriptions continue unchanged
  'INACTIVE',
]);

export const billingInterval = pgEnum('BillingInterval', [
  // Billed every month — highest per-month cost, lowest commitment
  'MONTHLY',
  // Billed every 3 months — moderate discount over monthly
  'QUARTERLY',
  // Billed every 6 months — mid-range discount between quarterly and annual
  'SEMI_ANNUAL',
  // Billed once per year — deepest discount, highest upfront commitment
  'ANNUAL',
]);

export const subscriptionStatus = pgEnum('SubscriptionStatus', [
  // Free trial period — institute has full access until trial expiry date
  'TRIALING',
  // Institute subscription is current and all features are accessible
  'ACTIVE',
  // Subscription temporarily frozen (e.g., summer break) — data preserved, access frozen
  'PAUSED',
  // Payment failed but grace period is still running — institute retains access temporarily
  'PAST_DUE',
  // Subscription was canceled by reseller or institute — access ends at period close
  'CANCELLED',
  // Subscription reached its end date without renewal — no further access
  'EXPIRED',
]);

export const invoiceStatus = pgEnum('InvoiceStatus', [
  // Invoice generated but not yet finalized or sent to the institute
  'DRAFT',
  // Invoice finalized and sent to the institute — awaiting payment
  'SENT',
  // Payment received and confirmed by the payment gateway — full amount settled
  'PAID',
  // Partial payment received — remaining balance still outstanding
  'PARTIALLY_PAID',
  // Payment deadline passed without successful payment — triggers dunning flow
  'OVERDUE',
  // Invoice voided by reseller or system — no longer requires payment
  'CANCELLED',
  // Payment was reversed — amount returned to institute, invoice no longer counts as revenue
  'REFUNDED',
]);

export const paymentStatus = pgEnum('PaymentStatus', [
  // Payment initiated but not yet submitted to the gateway
  'PENDING',
  // Payment submitted to gateway and awaiting confirmation (async UPI, bank transfer)
  'PROCESSING',
  // Gateway confirmed the payment — funds captured successfully
  'SUCCEEDED',
  // Payment attempt rejected by the gateway (insufficient funds, card declined, etc.)
  'FAILED',
  // Full amount reversed and returned to the payer
  'REFUNDED',
  // Partial amount reversed — difference still retained as revenue
  'PARTIALLY_REFUNDED',
]);

export const paymentMethod = pgEnum('PaymentMethod', [
  // Razorpay payment gateway — supports UPI, netbanking, cards, EMI
  'RAZORPAY',
  // Cashfree Payments — Indian payment gateway supporting UPI, netbanking, cards
  'CASHFREE',
  // Direct P2P UPI transfer to reseller's VPA — verified via UTR number submission
  'UPI_P2P',
  // Reseller manually records a UPI transfer (legacy/manual, no UTR verification flow)
  'UPI',
  // NEFT/RTGS/IMPS bank transfer — manual reconciliation required
  'BANK_TRANSFER',
  // Physical cash payment — collected offline by field agent, with collected-by tracking
  'CASH',
  // Cheque payment — requires clearance period before marking as succeeded
  'CHEQUE',
]);

export const gatewayConfigStatus = pgEnum('GatewayConfigStatus', [
  // Gateway credentials are valid and this config is used for processing payments
  'ACTIVE',
  // Gateway config disabled — payments routed to another active config or blocked
  'INACTIVE',
]);
