import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, institutes, withAdmin } from '@roviq/database';
import { gatewayConfigs } from '@roviq/ee-database';
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
        .select({ provider: gatewayConfigs.provider, credentials: gatewayConfigs.credentials })
        .from(gatewayConfigs)
        .innerJoin(institutes, eq(institutes.resellerId, gatewayConfigs.resellerId))
        .where(
          and(
            eq(institutes.id, instituteId),
            isNull(gatewayConfigs.deletedAt),
            eq(gatewayConfigs.isDefault, true),
          ),
        )
        .limit(1);

      if (!result[0]) {
        throw new NotFoundException(`PaymentGatewayConfig not found for institute ${instituteId}`);
      }

      return result[0];
    });
  }

  async findActiveByResellerId(
    resellerId: string,
    provider?: string,
  ): Promise<PaymentGatewayConfigRecord | null> {
    return withAdmin(this.db, async (tx) => {
      const conditions = [
        eq(gatewayConfigs.resellerId, resellerId),
        isNull(gatewayConfigs.deletedAt),
        eq(gatewayConfigs.status, 'ACTIVE'),
      ];
      if (provider) {
        conditions.push(eq(gatewayConfigs.provider, provider));
      } else {
        conditions.push(eq(gatewayConfigs.isDefault, true));
      }

      const [config] = await tx
        .select({ provider: gatewayConfigs.provider, credentials: gatewayConfigs.credentials })
        .from(gatewayConfigs)
        .where(and(...conditions))
        .limit(1);

      return config ?? null;
    });
  }
}
