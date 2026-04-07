import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CashfreeAdapter } from '../adapters/cashfree.adapter';
import { RazorpayAdapter } from '../adapters/razorpay.adapter';
import { CryptoService } from '../crypto/crypto.service';
import type { PaymentGateway } from '../ports/payment-gateway.port';
import { PaymentGatewayConfigRepository } from '../repositories/payment-gateway-config.repository';

/** LRU cache entry with 60s TTL */
interface CacheEntry {
  adapter: PaymentGateway;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PaymentGatewayFactory {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly configRepo: PaymentGatewayConfigRepository,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Get a payment gateway adapter for a reseller.
   * Loads gateway config, decrypts credentials, instantiates adapter.
   * Results are cached for 60s per reseller+provider.
   */
  async create(resellerId: string, provider?: string): Promise<PaymentGateway> {
    const gwConfig = await this.configRepo.findActiveByResellerId(resellerId, provider);
    if (!gwConfig) {
      throw new NotFoundException(
        `No active payment gateway configured for reseller ${resellerId}${provider ? ` (${provider})` : ''}`,
      );
    }

    const cacheKey = `${resellerId}:${gwConfig.provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.adapter;
    }

    // Decrypt credentials
    const credentials = gwConfig.credentials
      ? this.crypto.decrypt<Record<string, string>>(gwConfig.credentials as string)
      : {};

    const adapter = this.instantiate(gwConfig.provider as 'RAZORPAY' | 'CASHFREE', credentials);

    this.cache.set(cacheKey, { adapter, expiresAt: Date.now() + CACHE_TTL_MS });
    return adapter;
  }

  /** Get adapter using global env config (for testing/fallback) */
  getForProvider(provider: 'CASHFREE' | 'RAZORPAY'): PaymentGateway {
    const cacheKey = `global:${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.adapter;
    }

    let adapter: PaymentGateway;
    if (provider === 'RAZORPAY') {
      adapter = new RazorpayAdapter(this.config);
    } else if (provider === 'CASHFREE') {
      adapter = new CashfreeAdapter(this.config);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    this.cache.set(cacheKey, { adapter, expiresAt: Date.now() + CACHE_TTL_MS });
    return adapter;
  }

  /** @deprecated Use create(resellerId) instead */
  async getForInstitute(instituteId: string): Promise<PaymentGateway> {
    const gwConfig = await this.configRepo.findByInstituteId(instituteId);
    return this.getForProvider(gwConfig.provider as 'CASHFREE' | 'RAZORPAY');
  }

  private instantiate(
    provider: 'RAZORPAY' | 'CASHFREE',
    credentials: Record<string, string>,
  ): PaymentGateway {
    // Create a config reader backed by decrypted credentials
    // Cast to ConfigService: adapters only use getOrThrow(), and this object
    // satisfies that contract. A full ConfigService can't be instantiated
    // outside NestJS DI, and restructuring adapters to use a narrow interface
    // would break the standard NestJS ConfigService injection pattern.
    const credConfig = {
      get: (key: string) => credentials[key],
      getOrThrow: (key: string) => {
        const val = credentials[key];
        if (val === undefined) throw new Error(`Missing credential: ${key}`);
        return val;
      },
    } as ConfigService;

    if (provider === 'RAZORPAY') return new RazorpayAdapter(credConfig);
    if (provider === 'CASHFREE') return new CashfreeAdapter(credConfig);
    throw new Error(`Unknown provider: ${provider}`);
  }
}
