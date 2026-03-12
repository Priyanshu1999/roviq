import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import { type AttendanceAbsentEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { tenantContext } from '@roviq/prisma-client';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Injectable()
export class AttendanceListener implements OnModuleInit {
  private readonly logger = new Logger(AttendanceListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to attendance notification events');

    void subscribe<AttendanceAbsentEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.ATTENDANCE_ABSENT,
        durableName: 'notification-attendance',
      },
      (payload, meta) => this.handleAbsent(payload, meta),
    );
  }

  private async handleAbsent(event: AttendanceAbsentEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing attendance absent for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
      const config = await this.preferenceLoader.loadConfig(event.tenantId, 'ATTENDANCE');

      await this.triggerService.trigger({
        workflowId: 'attendance-absent',
        to: { subscriberId: event.studentId },
        payload: {
          studentName: event.studentName,
          sectionName: event.sectionName,
          date: event.date,
          markedBy: event.markedBy,
          config: {
            inApp: config.inApp,
            whatsapp: config.whatsapp,
            email: config.email,
            push: config.push,
          },
          digestCron: config.digestCron,
        },
        tenantId: event.tenantId,
      });
    });
  }
}
