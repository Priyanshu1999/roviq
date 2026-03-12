import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import {
  type FeeOverdueEvent,
  type FeeReminderEvent,
  NOTIFICATION_SUBJECTS,
} from '@roviq/notifications';
import { tenantContext } from '@roviq/prisma-client';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Injectable()
export class FeeListener implements OnModuleInit {
  private readonly logger = new Logger(FeeListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to fee notification events');

    void subscribe<FeeOverdueEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.FEE_OVERDUE,
        durableName: 'notification-fee',
      },
      (payload, meta) => this.handleOverdue(payload, meta),
    );

    void subscribe<FeeReminderEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.FEE_REMINDER,
        durableName: 'notification-fee',
      },
      (payload, meta) => this.handleReminder(payload, meta),
    );
  }

  private async handleOverdue(event: FeeOverdueEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing fee overdue for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
      const config = await this.preferenceLoader.loadConfig(event.tenantId, 'FEE');

      await this.triggerService.trigger({
        workflowId: 'fee-overdue',
        to: { subscriberId: event.studentId },
        payload: {
          studentName: event.studentName,
          feeId: event.feeId,
          amount: event.amount,
          currency: event.currency,
          dueDate: event.dueDate,
          daysOverdue: event.daysOverdue,
          feeType: event.feeType,
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

  private async handleReminder(event: FeeReminderEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing fee reminder for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
      const config = await this.preferenceLoader.loadConfig(event.tenantId, 'FEE');

      await this.triggerService.trigger({
        workflowId: 'fee-reminder',
        to: { subscriberId: event.studentId },
        payload: {
          studentName: event.studentName,
          feeId: event.feeId,
          amount: event.amount,
          currency: event.currency,
          dueDate: event.dueDate,
          feeType: event.feeType,
          feePeriod: event.feePeriod,
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
