import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import {
  type FeeOverdueEvent,
  type FeeReminderEvent,
  NOTIFICATION_SUBJECTS,
} from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Controller()
export class FeeListener {
  private readonly logger = new Logger(FeeListener.name);

  constructor(
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  @EventPattern('NOTIFICATION.fee.*', {
    stream: 'NOTIFICATION',
    durable: 'notification-fee',
  })
  async handleFeeEvent(
    @Payload() event: FeeOverdueEvent & FeeReminderEvent,
    @Ctx() ctx: JetStreamContext,
  ): Promise<void> {
    const subject = ctx.getSubject();
    this.logger.log(`Received fee event on subject "${subject}"`);

    if (subject === NOTIFICATION_SUBJECTS.FEE_OVERDUE) {
      await this.handleOverdue(event as FeeOverdueEvent);
    } else if (subject === NOTIFICATION_SUBJECTS.FEE_REMINDER) {
      await this.handleReminder(event as FeeReminderEvent);
    }
  }

  private async handleOverdue(event: FeeOverdueEvent): Promise<void> {
    this.logger.log(
      `Processing fee overdue for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

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
  }

  private async handleReminder(event: FeeReminderEvent): Promise<void> {
    this.logger.log(
      `Processing fee reminder for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

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
  }
}
