import type { PaymentGatewayConfigRecord } from './types';

export abstract class PaymentGatewayConfigRepository {
  abstract findByInstituteId(instituteId: string): Promise<PaymentGatewayConfigRecord>;
}
