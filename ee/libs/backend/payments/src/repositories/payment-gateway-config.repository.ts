import type { PaymentGatewayConfigRecord } from './types';

export abstract class PaymentGatewayConfigRepository {
  abstract findByInstituteId(instituteId: string): Promise<PaymentGatewayConfigRecord>;
  abstract findActiveByResellerId(
    resellerId: string,
    provider?: string,
  ): Promise<PaymentGatewayConfigRecord | null>;
}
