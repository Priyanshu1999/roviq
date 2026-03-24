import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRequestContext } from '@roviq/common-types';
import type { gatewayConfigs } from '@roviq/ee-database';
import { CryptoService } from '@roviq/ee-payments';
import { billingError } from '../billing.errors';
import { GatewayConfigRepository } from '../repositories/gateway-config.repository';

type GatewayConfigRow = typeof gatewayConfigs.$inferSelect;

@Injectable()
export class GatewayConfigService {
  constructor(
    private readonly repo: GatewayConfigRepository,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  async listConfigs(resellerId: string) {
    const configs = await this.repo.findByResellerId(resellerId);
    return configs.map((c) => this.toPublicConfig(c, resellerId));
  }

  async getConfig(resellerId: string, id: string) {
    const config = await this.repo.findById(resellerId, id);
    if (!config) billingError('GATEWAY_NOT_CONFIGURED', 'Gateway config not found');
    return this.toPublicConfig(config, resellerId);
  }

  async createConfig(
    resellerId: string,
    input: {
      provider: string;
      displayName?: string;
      credentials: Record<string, string>;
      webhookSecret?: string;
      isDefault?: boolean;
      testMode?: boolean;
      supportedMethods?: string[];
    },
  ) {
    const { userId } = getRequestContext();

    // UPI_DIRECT: reject testMode and webhookSecret (no gateway SDK)
    if (input.provider === 'UPI_DIRECT') {
      if (input.testMode) {
        billingError('GATEWAY_NOT_CONFIGURED', 'UPI_DIRECT does not support testMode');
      }
      if (input.webhookSecret) {
        billingError('GATEWAY_NOT_CONFIGURED', 'UPI_DIRECT does not support webhookSecret');
      }
    }

    // Encrypt credentials before storage
    const encryptedCredentials = this.crypto.encrypt(input.credentials);
    const encryptedWebhookSecret = input.webhookSecret
      ? this.crypto.encrypt(input.webhookSecret)
      : null;

    const config = await this.repo.create(resellerId, {
      resellerId,
      provider: input.provider,
      displayName: input.displayName ?? null,
      credentials: encryptedCredentials,
      webhookSecret: encryptedWebhookSecret,
      isDefault: input.isDefault ?? false,
      testMode: input.testMode ?? false,
      supportedMethods: input.supportedMethods ?? [],
      createdBy: userId,
      updatedBy: userId,
    });

    return this.toPublicConfig(config, resellerId);
  }

  async updateConfig(
    resellerId: string,
    id: string,
    input: {
      displayName?: string;
      credentials?: Record<string, string>;
      webhookSecret?: string;
      isDefault?: boolean;
      testMode?: boolean;
      supportedMethods?: string[];
      status?: string;
    },
  ) {
    const data: Partial<GatewayConfigRow> = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.testMode !== undefined) data.testMode = input.testMode;
    if (input.supportedMethods !== undefined) data.supportedMethods = input.supportedMethods;
    if (input.status !== undefined) data.status = input.status as GatewayConfigRow['status'];

    // Re-encrypt if credentials updated
    if (input.credentials !== undefined) {
      data.credentials = this.crypto.encrypt(input.credentials);
    }
    if (input.webhookSecret !== undefined) {
      data.webhookSecret = this.crypto.encrypt(input.webhookSecret);
    }

    const config = await this.repo.update(resellerId, id, data);
    if (!config) billingError('GATEWAY_NOT_CONFIGURED', 'Gateway config not found');
    return this.toPublicConfig(config, resellerId);
  }

  async deleteConfig(resellerId: string, id: string) {
    await this.repo.softDelete(resellerId, id);
  }

  /** Strip credentials from config — GraphQL output NEVER includes credentials */
  private toPublicConfig(config: GatewayConfigRow, resellerId: string) {
    const apiBaseUrl = this.config.get<string>('API_BASE_URL', 'https://api.roviq.com');
    const provider = config.provider.toLowerCase();
    return {
      id: config.id,
      resellerId: config.resellerId,
      provider: config.provider,
      status: config.status,
      displayName: config.displayName,
      isDefault: config.isDefault,
      testMode: config.testMode,
      supportedMethods: config.supportedMethods,
      webhookUrl:
        config.provider === 'UPI_DIRECT'
          ? null
          : `${apiBaseUrl}/webhooks/${provider}/${resellerId}`,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
