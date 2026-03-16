import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashfreeAdapter } from '../../adapters/cashfree.adapter';
import { RazorpayAdapter } from '../../adapters/razorpay.adapter';
import { PaymentGatewayFactory } from '../payment-gateway.factory';

vi.mock('razorpay', () => ({
  default: vi.fn(class MockRazorpay {}),
  validateWebhookSignature: vi.fn(),
}));

vi.mock('razorpay/dist/utils/razorpay-utils', () => ({
  validateWebhookSignature: vi.fn(),
}));

vi.mock('cashfree-pg', () => ({
  Cashfree: vi.fn(class MockCashfree {}),
  CFEnvironment: { SANDBOX: 1, PRODUCTION: 2 },
}));

function createMockConfig(): ConfigService {
  const values: Record<string, string> = {
    RAZORPAY_KEY_ID: 'rzp_test',
    RAZORPAY_KEY_SECRET: 'secret',
    RAZORPAY_WEBHOOK_SECRET: 'whsec',
    CASHFREE_CLIENT_ID: 'cf_test',
    CASHFREE_CLIENT_SECRET: 'cf_secret',
    CASHFREE_ENVIRONMENT: 'SANDBOX',
    CASHFREE_API_VERSION: '2025-01-01',
  };
  return {
    getOrThrow: vi.fn((key: string) => values[key] ?? ''),
  };
}

function createMockConfigRepo() {
  return {
    findByInstituteId: vi.fn(),
  };
}

describe('PaymentGatewayFactory', () => {
  let factory: PaymentGatewayFactory;
  let mockConfigRepo: ReturnType<typeof createMockConfigRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigRepo = createMockConfigRepo();
    factory = new PaymentGatewayFactory(createMockConfig(), mockConfigRepo as never);
  });

  describe('getForProvider', () => {
    it('should return RazorpayAdapter for RAZORPAY', () => {
      const adapter = factory.getForProvider('RAZORPAY');
      expect(adapter).toBeInstanceOf(RazorpayAdapter);
    });

    it('should return CashfreeAdapter for CASHFREE', () => {
      const adapter = factory.getForProvider('CASHFREE');
      expect(adapter).toBeInstanceOf(CashfreeAdapter);
    });

    it('should cache adapter instances', () => {
      const first = factory.getForProvider('RAZORPAY');
      const second = factory.getForProvider('RAZORPAY');
      expect(first).toBe(second);
    });

    it('should throw for unknown provider', () => {
      // @ts-expect-error testing invalid provider at runtime
      expect(() => factory.getForProvider('STRIPE')).toThrow('Unknown provider');
    });
  });

  describe('getForInstitute', () => {
    it('should look up config and return correct adapter', async () => {
      mockConfigRepo.findByInstituteId.mockResolvedValue({
        provider: 'CASHFREE',
      });

      const adapter = await factory.getForInstitute('institute-123');
      expect(adapter).toBeInstanceOf(CashfreeAdapter);
      expect(mockConfigRepo.findByInstituteId).toHaveBeenCalledWith('institute-123');
    });
  });
});
