/**
 * Billing integration tests — requires @roviq/testing lib (Phase 4).
 * Tracked: ROV-133
 *
 * These tests will use createIntegrationApp() with a real PostgreSQL database
 * + mocked NATS to verify end-to-end billing flows through resolvers, services,
 * repositories, and RLS.
 */
import { describe, it } from 'vitest';

describe('Billing Integration', () => {
  describe('Full billing flow', () => {
    it.todo('plan → subscription → invoice → payment → renewal');
  });

  describe('Gateway payment flow', () => {
    it.todo('initiatePayment → mock gateway → verifyPayment → invoice paid');
  });

  describe('Webhook idempotency', () => {
    it.todo('duplicate webhook with same gatewayPaymentId creates only one payment');
  });

  describe('Reseller deletion cleanup', () => {
    it.todo('transfers subscriptions, deactivates plans+configs, preserves invoices');
  });

  describe('Billing suspension/reactivation', () => {
    it.todo('cancel subscription → institute suspended → pay → reactivated');
  });

  describe('Plan change proration', () => {
    it.todo('mid-cycle plan change generates correct proration line item');
  });
});
