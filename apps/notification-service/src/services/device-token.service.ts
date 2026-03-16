import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Novu } from '@novu/api';
import { ChatOrPushProviderEnum } from '@novu/api/models/components';
import { createNovuClient } from '@roviq/notifications';

@Injectable()
export class DeviceTokenService {
  private readonly logger = new Logger(DeviceTokenService.name);
  private readonly novu: Novu;

  constructor(config: ConfigService) {
    this.novu = createNovuClient(config);
  }

  /**
   * Registers an FCM device token with Novu for the given subscriber.
   * Uses `credentials.update()` which replaces any existing device tokens
   * for this provider on the subscriber.
   */
  async registerDeviceToken(subscriberId: string, deviceToken: string): Promise<void> {
    this.logger.log(`Registering FCM device token for subscriber "${subscriberId}"`);

    await this.novu.subscribers.credentials.update(
      {
        providerId: ChatOrPushProviderEnum.Fcm,
        credentials: {
          deviceTokens: [deviceToken],
        },
      },
      subscriberId,
    );
  }
}
