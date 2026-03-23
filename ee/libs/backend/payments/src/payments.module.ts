import { Module } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { PaymentGatewayFactory } from './factory/payment-gateway.factory';
import { PaymentGatewayConfigDrizzleRepository } from './repositories/payment-gateway-config.drizzle-repository';
import { PaymentGatewayConfigRepository } from './repositories/payment-gateway-config.repository';

@Module({
  providers: [
    {
      provide: PaymentGatewayConfigRepository,
      useClass: PaymentGatewayConfigDrizzleRepository,
    },
    CryptoService,
    PaymentGatewayFactory,
  ],
  exports: [PaymentGatewayFactory, CryptoService],
})
export class PaymentsModule {}
