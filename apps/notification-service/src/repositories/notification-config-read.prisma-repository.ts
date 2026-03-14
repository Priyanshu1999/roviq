import { Inject, Injectable } from '@nestjs/common';
import { TENANT_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { TenantPrismaClient } from '@roviq/prisma-client';
import { NotificationConfigReadRepository } from './notification-config-read.repository';
import type { NotificationConfigRecord } from './types';

@Injectable()
export class NotificationConfigReadPrismaRepository extends NotificationConfigReadRepository {
  constructor(@Inject(TENANT_PRISMA_CLIENT) private readonly prisma: TenantPrismaClient) {
    super();
  }

  async findByTenantAndType(
    tenantId: string,
    notificationType: string,
  ): Promise<NotificationConfigRecord | null> {
    return this.prisma.instituteNotificationConfig.findUnique({
      where: {
        tenantId_notificationType: { tenantId, notificationType },
      },
      select: {
        inAppEnabled: true,
        whatsappEnabled: true,
        emailEnabled: true,
        pushEnabled: true,
        digestEnabled: true,
        digestCron: true,
      },
    });
  }
}
