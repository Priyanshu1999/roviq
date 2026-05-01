import { Inject, Injectable } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  instituteNotificationConfigs,
  instituteNotificationConfigsLive,
  mkInstituteCtx,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { asc } from 'drizzle-orm';
import { NotificationConfigRepository } from './notification-config.repository';
import type { NotificationConfigRecord, UpsertNotificationConfigData } from './types';

@Injectable()
export class NotificationConfigDrizzleRepository extends NotificationConfigRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAll(): Promise<NotificationConfigRecord[]> {
    const { tenantId } = getRequestContext();
    if (!tenantId) {
      throw new Error('Tenant context is required for findAll');
    }

    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      return tx
        .select({
          id: instituteNotificationConfigsLive.id,
          tenantId: instituteNotificationConfigsLive.tenantId,
          notificationType: instituteNotificationConfigsLive.notificationType,
          inAppEnabled: instituteNotificationConfigsLive.inAppEnabled,
          whatsappEnabled: instituteNotificationConfigsLive.whatsappEnabled,
          emailEnabled: instituteNotificationConfigsLive.emailEnabled,
          pushEnabled: instituteNotificationConfigsLive.pushEnabled,
          digestEnabled: instituteNotificationConfigsLive.digestEnabled,
          digestCron: instituteNotificationConfigsLive.digestCron,
        })
        .from(instituteNotificationConfigsLive)
        .orderBy(asc(instituteNotificationConfigsLive.notificationType));
    });
  }

  async upsert(data: UpsertNotificationConfigData): Promise<NotificationConfigRecord> {
    const { tenantId, notificationType, ...rest } = data;
    const { userId } = getRequestContext();

    return withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const result = await tx
        .insert(instituteNotificationConfigs)
        .values({
          tenantId,
          notificationType,
          inAppEnabled: rest.inAppEnabled,
          whatsappEnabled: rest.whatsappEnabled,
          emailEnabled: rest.emailEnabled,
          pushEnabled: rest.pushEnabled,
          digestEnabled: rest.digestEnabled,
          digestCron: rest.digestCron,
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            instituteNotificationConfigs.tenantId,
            instituteNotificationConfigs.notificationType,
          ],
          set: {
            ...(rest.inAppEnabled !== undefined && { inAppEnabled: rest.inAppEnabled }),
            ...(rest.whatsappEnabled !== undefined && { whatsappEnabled: rest.whatsappEnabled }),
            ...(rest.emailEnabled !== undefined && { emailEnabled: rest.emailEnabled }),
            ...(rest.pushEnabled !== undefined && { pushEnabled: rest.pushEnabled }),
            ...(rest.digestEnabled !== undefined && { digestEnabled: rest.digestEnabled }),
            ...(rest.digestCron !== undefined && { digestCron: rest.digestCron }),
            updatedAt: new Date(),
            updatedBy: userId,
          },
        })
        .returning({
          id: instituteNotificationConfigs.id,
          tenantId: instituteNotificationConfigs.tenantId,
          notificationType: instituteNotificationConfigs.notificationType,
          inAppEnabled: instituteNotificationConfigs.inAppEnabled,
          whatsappEnabled: instituteNotificationConfigs.whatsappEnabled,
          emailEnabled: instituteNotificationConfigs.emailEnabled,
          pushEnabled: instituteNotificationConfigs.pushEnabled,
          digestEnabled: instituteNotificationConfigs.digestEnabled,
          digestCron: instituteNotificationConfigs.digestCron,
        });

      return result[0];
    });
  }
}
