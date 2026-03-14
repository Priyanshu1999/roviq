import type { PaymentGatewayConfigRecord } from './types';

export abstract class PaymentGatewayConfigRepository {
  abstract findByOrganizationId(organizationId: string): Promise<PaymentGatewayConfigRecord>;
}
