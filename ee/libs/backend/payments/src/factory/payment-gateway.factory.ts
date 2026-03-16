import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CashfreeAdapter } from '../adapters/cashfree.adapter';
import { RazorpayAdapter } from '../adapters/razorpay.adapter';
import type { PaymentGateway } from '../ports/payment-gateway.port';
import { PaymentGatewayConfigRepository } from '../repositories/payment-gateway-config.repository';

@Injectable()
export class PaymentGatewayFactory {
  private readonly adapters = new Map<string, PaymentGateway>();

  constructor(
    private readonly config: ConfigService,
    private readonly configRepo: PaymentGatewayConfigRepository,
  ) {}

  async getForInstitute(instituteId: string): Promise<PaymentGateway> {
    const gwConfig = await this.configRepo.findByInstituteId(instituteId);
    return this.getForProvider(gwConfig.provider as 'CASHFREE' | 'RAZORPAY');
  }

  getForProvider(provider: 'CASHFREE' | 'RAZORPAY'): PaymentGateway {
    let adapter = this.adapters.get(provider);
    if (!adapter) {
      if (provider === 'RAZORPAY') {
        adapter = new RazorpayAdapter(this.config);
      } else if (provider === 'CASHFREE') {
        adapter = new CashfreeAdapter(this.config);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
      this.adapters.set(provider, adapter);
    }
    return adapter;
  }
}
