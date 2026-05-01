import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  instituteNotificationConfigs,
  mkInstituteCtx,
  withTenant,
} from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import { NotificationConfigReadRepository } from './notification-config-read.repository';
import type { NotificationConfigRecord } from './types';

@Injectable()
export class NotificationConfigReadDrizzleRepository extends NotificationConfigReadRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findByTenantAndType(
    tenantId: string,
    notificationType: string,
  ): Promise<NotificationConfigRecord | null> {
    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const result = await tx
        .select({
          inAppEnabled: instituteNotificationConfigs.inAppEnabled,
          whatsappEnabled: instituteNotificationConfigs.whatsappEnabled,
          emailEnabled: instituteNotificationConfigs.emailEnabled,
          pushEnabled: instituteNotificationConfigs.pushEnabled,
          digestEnabled: instituteNotificationConfigs.digestEnabled,
          digestCron: instituteNotificationConfigs.digestCron,
        })
        .from(instituteNotificationConfigs)
        .where(
          and(
            eq(instituteNotificationConfigs.tenantId, tenantId),
            eq(instituteNotificationConfigs.notificationType, notificationType),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    });
  }
}
