import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import { type AttendanceAbsentEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Controller()
export class AttendanceListener {
  private readonly logger = new Logger(AttendanceListener.name);

  constructor(
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  @EventPattern(NOTIFICATION_SUBJECTS.ATTENDANCE_ABSENT, {
    stream: 'NOTIFICATION',
    durable: 'notification-attendance',
  })
  async handleAbsent(
    @Payload() event: AttendanceAbsentEvent,
    @Ctx() _ctx: JetStreamContext,
  ): Promise<void> {
    this.logger.log(
      `Processing attendance absent for student "${event.studentId}" in tenant "${event.tenantId}"`,
    );

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
  }
}
