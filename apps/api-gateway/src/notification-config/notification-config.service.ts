import { Inject, Injectable } from '@nestjs/common';
import { TENANT_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { TenantPrismaClient } from '@roviq/prisma-client';
import type { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import type { NotificationConfigModel } from './models/notification-config.model';

@Injectable()
export class NotificationConfigService {
  constructor(@Inject(TENANT_PRISMA_CLIENT) private readonly tenantPrisma: TenantPrismaClient) {}

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
}
