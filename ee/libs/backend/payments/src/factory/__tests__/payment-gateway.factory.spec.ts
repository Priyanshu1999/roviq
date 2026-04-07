import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashfreeAdapter } from '../../adapters/cashfree.adapter';
import { RazorpayAdapter } from '../../adapters/razorpay.adapter';
import { CryptoService } from '../../crypto/crypto.service';
import { PaymentGatewayConfigRepository } from '../../repositories/payment-gateway-config.repository';
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

const CONFIG_VALUES: Record<string, string> = {
  RAZORPAY_KEY_ID: 'rzp_test',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'whsec',
  CASHFREE_CLIENT_ID: 'cf_test',
  CASHFREE_CLIENT_SECRET: 'cf_secret',
  CASHFREE_ENVIRONMENT: 'SANDBOX',
  CASHFREE_API_VERSION: '2025-01-01',
};

/**
 * Build a real ConfigService instance backed by an in-memory record.
 * Uses the actual ConfigService class so type assertions aren't needed.
 */
function createConfigService(): ConfigService {
  return new ConfigService({ ...CONFIG_VALUES });
}

class MockConfigRepo extends PaymentGatewayConfigRepository {
  findByInstituteId = vi.fn();
  findActiveByResellerId = vi.fn();
}

class MockCryptoService extends CryptoService {
  constructor() {
    // Bypass parent constructor (which reads BILLING_ENCRYPTION_KEY)
    super(new ConfigService({ BILLING_ENCRYPTION_KEY: 'a'.repeat(64) }));
  }
  override encrypt = vi.fn();
  override decrypt = vi.fn();
}

describe('PaymentGatewayFactory', () => {
  let factory: PaymentGatewayFactory;
  let configRepo: MockConfigRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    configRepo = new MockConfigRepo();
    factory = new PaymentGatewayFactory(createConfigService(), configRepo, new MockCryptoService());
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

    it('should throw for unknown provider', () => {
      expect(() => factory.getForProvider('STRIPE' as 'RAZORPAY')).toThrow('Unknown provider');
    });

    it('should cache adapter instances', () => {
      const a1 = factory.getForProvider('RAZORPAY');
      const a2 = factory.getForProvider('RAZORPAY');
      expect(a1).toBe(a2);
    });
  });

  describe('getForInstitute', () => {
    it('should call configRepo.findByInstituteId and return adapter', async () => {
      configRepo.findByInstituteId.mockResolvedValue({
        provider: 'RAZORPAY',
        credentials: null,
      });

      const adapter = await factory.getForInstitute('inst-1');
      expect(adapter).toBeInstanceOf(RazorpayAdapter);
      expect(configRepo.findByInstituteId).toHaveBeenCalledWith('inst-1');
    });
  });
});
