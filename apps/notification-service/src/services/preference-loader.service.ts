import { Injectable, Logger } from '@nestjs/common';
import { NotificationConfigReadRepository } from '../repositories/notification-config-read.repository';

export interface ChannelConfig {
  inApp: boolean;
  whatsapp: boolean;
  email: boolean;
  push: boolean;
  digest: boolean;
  digestCron?: string;
}

const DEFAULT_CONFIG: ChannelConfig = {
  inApp: true,
  whatsapp: true,
  email: true,
  push: false,
  digest: false,
};

@Injectable()
export class PreferenceLoaderService {
  private readonly logger = new Logger(PreferenceLoaderService.name);

  constructor(private readonly configRepo: NotificationConfigReadRepository) {}

  /**
   * Loads per-institute notification channel configuration from the database.
   * Falls back to sensible defaults if no config is found for the given tenant + type.
   *
   * IMPORTANT: Caller must wrap this in `tenantContext.run({ tenantId }, ...)` for RLS to work.
   */
  async loadConfig(tenantId: string, notificationType: string): Promise<ChannelConfig> {
    const config = await this.configRepo.findByTenantAndType(tenantId, notificationType);

    if (!config) {
      this.logger.debug(
        `No config found for tenant "${tenantId}" type "${notificationType}", using defaults`,
      );
      return { ...DEFAULT_CONFIG };
    }

    return {
      inApp: config.inAppEnabled,
      whatsapp: config.whatsappEnabled,
      email: config.emailEnabled,
      push: config.pushEnabled,
      digest: config.digestEnabled,
      digestCron: config.digestCron ?? undefined,
    };
  }
}
