import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import { NOTIFICATION_SUBJECTS, type UserCreatedEvent } from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';

@Controller()
export class UserListener {
  private readonly logger = new Logger(UserListener.name);

  constructor(private readonly triggerService: NotificationTriggerService) {}

  @EventPattern(NOTIFICATION_SUBJECTS.USER_CREATED, {
    stream: 'NOTIFICATION',
    durable: 'notification-user-created',
  })
  async handleUserCreated(
    @Payload() event: UserCreatedEvent,
    @Ctx() _ctx: JetStreamContext,
  ): Promise<void> {
    this.logger.log(`Processing user.created for userId "${event.userId}" (scope: ${event.scope})`);

    await this.triggerService.trigger({
      workflowId: 'user-welcome',
      to: {
        subscriberId: event.userId,
        email: event.email,
        ...(event.phone ? { phone: event.phone } : {}),
      },
      payload: {
        username: event.username,
        email: event.email,
        phone: event.phone,
        firstName: event.firstName,
        lastName: event.lastName,
        tempPassword: event.tempPassword,
        scope: event.scope,
      },
      tenantId: event.tenantId ?? undefined,
    });
  }
}
