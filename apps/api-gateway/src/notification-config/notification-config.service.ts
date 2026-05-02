import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Novu } from '@novu/api';
import { ChatOrPushProviderEnum } from '@novu/api/models/components';
import { createNovuClient } from '@roviq/notifications';
import type { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import { NotificationConfigRepository } from './repositories/notification-config.repository';
import type { NotificationConfigRecord } from './repositories/types';

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);
  private readonly novu: Novu;

  constructor(
    private readonly notificationConfigRepo: NotificationConfigRepository,
    config: ConfigService,
  ) {
    this.novu = createNovuClient(config);
  }

  async findAll(): Promise<NotificationConfigRecord[]> {
    return this.notificationConfigRepo.findAll();
  }

  async update(
    tenantId: string,
    input: UpdateNotificationConfigInput,
  ): Promise<NotificationConfigRecord> {
    const { notificationType, ...data } = input;

    const config = await this.notificationConfigRepo.upsert({
      tenantId,
      notificationType,
      ...data,
    });

    return config;
  }

  async registerDeviceToken(subscriberId: string, deviceToken: string): Promise<boolean> {
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

    return true;
  }
}
