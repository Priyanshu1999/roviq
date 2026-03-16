import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Novu } from '@novu/api';
import { ChatOrPushProviderEnum } from '@novu/api/models/components';
import { createNovuClient } from '@roviq/notifications';
import type { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import type { NotificationConfigModel } from './models/notification-config.model';
import { NotificationConfigRepository } from './repositories/notification-config.repository';

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

  async findAll(): Promise<NotificationConfigModel[]> {
    const configs = await this.notificationConfigRepo.findAll();
    return configs as unknown as NotificationConfigModel[];
  }

  async update(
    tenantId: string,
    input: UpdateNotificationConfigInput,
  ): Promise<NotificationConfigModel> {
    const { notificationType, ...data } = input;

    const config = await this.notificationConfigRepo.upsert({
      tenantId,
      notificationType,
      ...data,
    });

    return config as unknown as NotificationConfigModel;
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
