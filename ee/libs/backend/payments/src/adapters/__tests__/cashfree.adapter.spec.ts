import { ConfigService } from '@nestjs/config';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CashfreeAdapter } from '../cashfree.adapter';

const mockSubsCreatePlan = vi.fn();
const mockSubsFetchPlan = vi.fn();
const mockSubsCreateSubscription = vi.fn();
const mockSubsFetchSubscription = vi.fn();
const mockSubsManageSubscription = vi.fn();
const mockSubsFetchSubscriptionPayments = vi.fn();
const mockSubsCreateRefund = vi.fn();
const mockPGVerifyWebhookSignature = vi.fn();

vi.mock('cashfree-pg', () => ({
  Cashfree: vi.fn(
    class MockCashfree {
      XApiVersion = '2025-01-01';
      SubsCreatePlan = mockSubsCreatePlan;
      SubsFetchPlan = mockSubsFetchPlan;
      SubsCreateSubscription = mockSubsCreateSubscription;
      SubsFetchSubscription = mockSubsFetchSubscription;
      SubsManageSubscription = mockSubsManageSubscription;
      SubsFetchSubscriptionPayments = mockSubsFetchSubscriptionPayments;
      SubsCreateRefund = mockSubsCreateRefund;
      PGVerifyWebhookSignature = mockPGVerifyWebhookSignature;
    },
  ),
  CFEnvironment: { SANDBOX: 1, PRODUCTION: 2 },
}));

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    CASHFREE_CLIENT_ID: 'cf_test_123',
    CASHFREE_CLIENT_SECRET: 'cf_secret_123',
    CASHFREE_ENVIRONMENT: 'SANDBOX',
    CASHFREE_API_VERSION: '2025-01-01',
    ...overrides,
  };
  return createMock<ConfigService>({
    getOrThrow: vi.fn((key: string) => {
      const val = values[key];
      if (!val) throw new Error(`Missing ${key}`);
      return val;
    }),
  });
}

describe('CashfreeAdapter', () => {
  let adapter: CashfreeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CashfreeAdapter(createMockConfig());
  });

  describe('createPlan', () => {
    it('should call SubsCreatePlan and map response', async () => {
      mockSubsCreatePlan.mockResolvedValue({
        data: { plan_id: 'plan_cf_123', plan_name: 'Pro Plan' },
      });

      const result = await adapter.createPlan({
        name: 'Pro Plan',
        amount: 99900n,
        currency: 'INR',
        interval: 'MONTHLY',
      });

      expect(result.providerPlanId).toBe('plan_cf_123');
    });
  });

  describe('verifyWebhook', () => {
    const headers = {
      'x-webhook-signature': 'sig123',
      'x-webhook-timestamp': '1234567890',
    };

    function verifyWithBody(body: Record<string, unknown>) {
      const rawBody = JSON.stringify(body);
      return adapter.verifyWebhook(headers, rawBody);
    }

    it('should verify signature and extract IDs from payment events', () => {
      const result = verifyWithBody({
        type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        data: {
          subscription_id: 'sub_123',
          cf_payment_id: 'pay_456',
        },
      });

      expect(mockPGVerifyWebhookSignature).toHaveBeenCalledWith(
        'sig123',
        expect.any(String),
        '1234567890',
      );
      expect(result.providerSubscriptionId).toBe('sub_123');
      expect(result.providerPaymentId).toBe('pay_456');
    });

    it('should extract subscription ID from status changed events', () => {
      const result = verifyWithBody({
        type: 'SUBSCRIPTION_STATUS_CHANGED',
        data: {
          subscription_details: {
            subscription_id: 'sub_789',
            subscription_status: 'ACTIVE',
          },
        },
      });

      expect(result.providerSubscriptionId).toBe('sub_789');
      expect(result.providerPaymentId).toBeUndefined();
    });

    it('should extract subscription ID from card expiry events', () => {
      const result = verifyWithBody({
        type: 'SUBSCRIPTION_CARD_EXPIRY_REMINDER',
        data: {
          subscription_status_webhook: {
            subscription_details: {
              subscription_id: 'sub_expiry',
              subscription_status: 'ACTIVE',
            },
          },
          card_expiry_date: '2026-06-01',
        },
      });

      expect(result.providerSubscriptionId).toBe('sub_expiry');
    });

    it('should normalize SUBSCRIPTION_PAYMENT_SUCCESS → subscription.charged', () => {
      const result = verifyWithBody({ type: 'SUBSCRIPTION_PAYMENT_SUCCESS' });
      expect(result.eventType).toBe('subscription.charged');
    });

    it('should normalize SUBSCRIPTION_PAYMENT_FAILED → payment.failed', () => {
      const result = verifyWithBody({ type: 'SUBSCRIPTION_PAYMENT_FAILED' });
      expect(result.eventType).toBe('payment.failed');
    });

    it('should normalize SUBSCRIPTION_PAYMENT_CANCELLED → payment.cancelled', () => {
      const result = verifyWithBody({ type: 'SUBSCRIPTION_PAYMENT_CANCELLED' });
      expect(result.eventType).toBe('payment.cancelled');
    });

    it('should normalize SUBSCRIPTION_CARD_EXPIRY_REMINDER → subscription.card_expiry_reminder', () => {
      const result = verifyWithBody({ type: 'SUBSCRIPTION_CARD_EXPIRY_REMINDER' });
      expect(result.eventType).toBe('subscription.card_expiry_reminder');
    });

    describe('SUBSCRIPTION_STATUS_CHANGED normalization', () => {
      function verifyStatusChanged(status: string) {
        return verifyWithBody({
          type: 'SUBSCRIPTION_STATUS_CHANGED',
          data: { subscription_details: { subscription_status: status } },
        });
      }

      it('ACTIVE → subscription.activated', () => {
        expect(verifyStatusChanged('ACTIVE').eventType).toBe('subscription.activated');
      });

      it('CUSTOMER_CANCELLED → subscription.cancelled', () => {
        expect(verifyStatusChanged('CUSTOMER_CANCELLED').eventType).toBe('subscription.cancelled');
      });

      it('CANCELLED → subscription.cancelled', () => {
        expect(verifyStatusChanged('CANCELLED').eventType).toBe('subscription.cancelled');
      });

      it('CUSTOMER_PAUSED → subscription.paused', () => {
        expect(verifyStatusChanged('CUSTOMER_PAUSED').eventType).toBe('subscription.paused');
      });

      it('ON_HOLD → subscription.halted', () => {
        expect(verifyStatusChanged('ON_HOLD').eventType).toBe('subscription.halted');
      });

      it('CARD_EXPIRED → subscription.halted', () => {
        expect(verifyStatusChanged('CARD_EXPIRED').eventType).toBe('subscription.halted');
      });

      it('COMPLETED → subscription.completed', () => {
        expect(verifyStatusChanged('COMPLETED').eventType).toBe('subscription.completed');
      });

      it('EXPIRED → subscription.completed', () => {
        expect(verifyStatusChanged('EXPIRED').eventType).toBe('subscription.completed');
      });

      it('LINK_EXPIRED → subscription.completed', () => {
        expect(verifyStatusChanged('LINK_EXPIRED').eventType).toBe('subscription.completed');
      });

      it('BANK_APPROVAL_PENDING → subscription.pending', () => {
        expect(verifyStatusChanged('BANK_APPROVAL_PENDING').eventType).toBe('subscription.pending');
      });

      it('unknown status → subscription.status_changed.<status>', () => {
        expect(verifyStatusChanged('SOME_NEW').eventType).toBe(
          'subscription.status_changed.some_new',
        );
      });
    });

    it('should pass through unknown event types unchanged', () => {
      const result = verifyWithBody({ type: 'SOME_UNKNOWN_EVENT' });
      expect(result.eventType).toBe('SOME_UNKNOWN_EVENT');
    });
  });
});
