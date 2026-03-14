import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { PaymentGatewayConfigRepository } from './payment-gateway-config.repository';
import type { PaymentGatewayConfigRecord } from './types';

@Injectable()
export class PaymentGatewayConfigPrismaRepository extends PaymentGatewayConfigRepository {
  constructor(@Inject(ADMIN_PRISMA_CLIENT) private readonly prisma: AdminPrismaClient) {
    super();
  }

  async findByOrganizationId(organizationId: string): Promise<PaymentGatewayConfigRecord> {
    return this.prisma.paymentGatewayConfig.findUniqueOrThrow({
      where: { organizationId },
      select: { provider: true },
    });
  }
}
