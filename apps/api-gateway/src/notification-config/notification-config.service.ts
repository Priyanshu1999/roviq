import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Novu } from '@novu/api';
import { ChatOrPushProviderEnum } from '@novu/api/models/components';
import { TENANT_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { TenantPrismaClient } from '@roviq/prisma-client';
import type { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import type { NotificationConfigModel } from './models/notification-config.model';

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);
  private readonly novu: Novu;

  constructor(
    @Inject(TENANT_PRISMA_CLIENT) private readonly tenantPrisma: TenantPrismaClient,
    config: ConfigService,
  ) {
    this.novu = new Novu({ secretKey: config.getOrThrow<string>('NOVU_SECRET_KEY') });
  }

  async findAll(): Promise<NotificationConfigModel[]> {
    const configs = await this.tenantPrisma.instituteNotificationConfig.findMany({
      orderBy: { notificationType: 'asc' },
    });
    return configs as unknown as NotificationConfigModel[];
  }

  async update(
    tenantId: string,
    input: UpdateNotificationConfigInput,
  ): Promise<NotificationConfigModel> {
    const { notificationType, ...data } = input;

    const config = await this.tenantPrisma.instituteNotificationConfig.upsert({
      where: {
        tenantId_notificationType: {
          tenantId,
          notificationType,
        },
      },
      update: data,
      create: {
        tenantId,
        notificationType,
        ...data,
      },
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
