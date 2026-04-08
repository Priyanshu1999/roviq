import { ConfigService } from '@nestjs/config';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RazorpayAdapter } from '../razorpay.adapter';

const mockPlans = { create: vi.fn(), fetch: vi.fn() };
const mockSubscriptions = {
  create: vi.fn(),
  fetch: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};
const mockInvoices = { all: vi.fn() };
const mockPayments = { refund: vi.fn() };

vi.mock('razorpay', () => ({
  default: vi.fn(
    class MockRazorpay {
      plans = mockPlans;
      subscriptions = mockSubscriptions;
      invoices = mockInvoices;
      payments = mockPayments;
    },
  ),
}));

const { mockValidateWebhookSignature } = vi.hoisted(() => ({
  mockValidateWebhookSignature: vi.fn(),
}));

vi.mock('razorpay/dist/utils/razorpay-utils', () => ({
  validateWebhookSignature: mockValidateWebhookSignature,
}));

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    RAZORPAY_KEY_ID: 'rzp_test_123',
    RAZORPAY_KEY_SECRET: 'secret_123',
    RAZORPAY_WEBHOOK_SECRET: 'whsec_123',
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

describe('RazorpayAdapter', () => {
  let adapter: RazorpayAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RazorpayAdapter(createMockConfig());
  });

  describe('createPlan', () => {
    it('should call razorpay plans.create and map the response', async () => {
      mockPlans.create.mockResolvedValue({
        id: 'plan_abc',
        item: { name: 'Pro Plan', amount: 99900, currency: 'INR' },
        period: 'monthly',
        interval: 1,
      });

      const result = await adapter.createPlan({
        name: 'Pro Plan',
        amount: 99900n,
        currency: 'INR',
        interval: 'MONTHLY',
      });

      expect(result.providerPlanId).toBe('plan_abc');
      expect(result.name).toBe('Pro Plan');
    });
  });

  describe('verifyWebhook', () => {
    it('should call validateWebhookSignature with correct params', () => {
      mockValidateWebhookSignature.mockReturnValue(true);

      const headers = { 'x-razorpay-signature': 'sig123' };
      const rawBody = '{"event":"payment.captured","payload":{}}';

      const result = adapter.verifyWebhook(headers, rawBody);

      expect(mockValidateWebhookSignature).toHaveBeenCalledWith(rawBody, 'sig123', 'whsec_123');
      expect(result.eventType).toBe('payment.captured');
    });
  });
});
