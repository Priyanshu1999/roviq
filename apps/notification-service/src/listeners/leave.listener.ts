import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import type { JetStreamContext } from '@roviq/nats-jetstream';
import { type LeaveDecidedEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';

/**
 * Consumes `NOTIFICATION.leave.decided` events emitted by the institute
 * LeaveService when a leave application reaches a terminal decision
 * (APPROVED or REJECTED). Triggers the `leave-decided` Novu workflow,
 * addressed to the applicant's membership id — Novu resolves to the
 * subscriber's preferred channel (in-app + email by default).
 */
@Controller()
export class LeaveListener {
  private readonly logger = new Logger(LeaveListener.name);

  constructor(private readonly triggerService: NotificationTriggerService) {}

  @EventPattern(NOTIFICATION_SUBJECTS.LEAVE_DECIDED, {
    stream: 'NOTIFICATION',
    durable: 'notification-leave',
  })
  async handleDecided(
    @Payload() event: LeaveDecidedEvent,
    @Ctx() _ctx: JetStreamContext,
  ): Promise<void> {
    this.logger.log(
      `Processing leave decision "${event.status}" for leave "${event.leaveId}" (user "${event.userId}")`,
    );

    await this.triggerService.trigger({
      workflowId: 'leave-decided',
      to: { subscriberId: event.userId },
      payload: {
        leaveId: event.leaveId,
        userId: event.userId,
        status: event.status,
      },
      tenantId: event.tenantId,
    });
  }
}
