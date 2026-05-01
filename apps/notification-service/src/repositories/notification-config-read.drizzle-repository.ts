import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  instituteNotificationConfigsLive,
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
          inAppEnabled: instituteNotificationConfigsLive.inAppEnabled,
          whatsappEnabled: instituteNotificationConfigsLive.whatsappEnabled,
          emailEnabled: instituteNotificationConfigsLive.emailEnabled,
          pushEnabled: instituteNotificationConfigsLive.pushEnabled,
          digestEnabled: instituteNotificationConfigsLive.digestEnabled,
          digestCron: instituteNotificationConfigsLive.digestCron,
        })
        .from(instituteNotificationConfigsLive)
        .where(
          and(
            eq(instituteNotificationConfigsLive.tenantId, tenantId),
            eq(instituteNotificationConfigsLive.notificationType, notificationType),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    });
  }
}
