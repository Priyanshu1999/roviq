import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CryptoService, PaymentGatewayFactory } from '@roviq/ee-payments';
import DataLoader from 'dataloader';
import { InvoiceModel } from './models/invoice.model';
import { GatewayConfigRepository } from './repositories/gateway-config.repository';

/** Statuses where a UPI payment URI should be shown */
const PAYABLE_STATUSES = new Set(['SENT', 'PARTIALLY_PAID', 'OVERDUE']);

/**
 * Resolves computed fields on InvoiceModel.
 * `upiPaymentUri` loads the reseller's UPI_DIRECT config (if any),
 * decrypts the VPA, and builds a upi://pay URI for the outstanding balance.
 */
@Resolver(() => InvoiceModel)
export class InvoiceFieldResolver {
  private readonly upiConfigLoader: DataLoader<string, string | null>;

  constructor(
    private readonly gatewayConfigRepo: GatewayConfigRepository,
    private readonly crypto: CryptoService,
  ) {
    // Batch reseller IDs → UPI_DIRECT VPA lookup
    this.upiConfigLoader = new DataLoader(async (resellerIds: readonly string[]) => {
      const results = new Map<string, string | null>();
      for (const resellerId of new Set(resellerIds)) {
        try {
          const configs = await this.gatewayConfigRepo.findByResellerId(resellerId);
          const upiConfig = configs.find(
            (c) => c.provider === 'UPI_DIRECT' && c.status === 'ACTIVE',
          );
          if (upiConfig?.credentials) {
            const decrypted = this.crypto.decrypt(upiConfig.credentials as string) as {
              vpa?: string;
            };
            results.set(resellerId, decrypted.vpa ?? null);
          } else {
            results.set(resellerId, null);
          }
        } catch {
          results.set(resellerId, null);
        }
      }
      return resellerIds.map((id) => results.get(id) ?? null);
    });
  }

  @ResolveField('upiPaymentUri', () => String, { nullable: true })
  async resolveUpiPaymentUri(@Parent() invoice: InvoiceModel): Promise<string | null> {
    // Only show URI for unpaid invoices
    if (!PAYABLE_STATUSES.has(invoice.status)) return null;

    const vpa = await this.upiConfigLoader.load(invoice.resellerId);
    if (!vpa) return null;

    const balancePaise = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (balancePaise <= 0) return null;

    const amountRupees = (balancePaise / 100).toFixed(2);
    const params = new URLSearchParams({
      pa: vpa,
      pn: 'Roviq',
      am: amountRupees,
      tn: `INV-${invoice.invoiceNumber}`,
      cu: 'INR',
    });

    return `upi://pay?${params.toString()}`;
  }
}
