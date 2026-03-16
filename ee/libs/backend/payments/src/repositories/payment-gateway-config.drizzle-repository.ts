import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, paymentGatewayConfigs, withAdmin } from '@roviq/database';
import { and, eq, isNull } from 'drizzle-orm';
import { PaymentGatewayConfigRepository } from './payment-gateway-config.repository';
import type { PaymentGatewayConfigRecord } from './types';

@Injectable()
export class PaymentGatewayConfigDrizzleRepository extends PaymentGatewayConfigRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findByInstituteId(instituteId: string): Promise<PaymentGatewayConfigRecord> {
    return withAdmin(this.db, async (tx) => {
      const result = await tx
        .select({ provider: paymentGatewayConfigs.provider })
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.instituteId, instituteId),
            isNull(paymentGatewayConfigs.deletedAt),
          ),
        )
        .limit(1);

      if (!result[0]) {
        throw new NotFoundException(`PaymentGatewayConfig not found for institute ${instituteId}`);
      }

      return result[0];
    });
  }
}
