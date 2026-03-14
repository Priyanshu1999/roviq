import { Module } from '@nestjs/common';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
import { PaymentGatewayFactory } from './factory/payment-gateway.factory';
import { PaymentGatewayConfigPrismaRepository } from './repositories/payment-gateway-config.prisma-repository';
import { PaymentGatewayConfigRepository } from './repositories/payment-gateway-config.repository';

@Module({
  imports: [PlatformDatabaseModule],
  providers: [
    {
      provide: PaymentGatewayConfigRepository,
      useClass: PaymentGatewayConfigPrismaRepository,
    },
    PaymentGatewayFactory,
  ],
  exports: [PaymentGatewayFactory],
})
export class PaymentsModule {}
