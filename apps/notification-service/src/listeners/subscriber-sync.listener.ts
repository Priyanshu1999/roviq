import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import { type UserSyncEvent } from '@roviq/notifications';
import { SubscriberSyncService } from '../services/subscriber-sync.service';

@Controller()
export class SubscriberSyncListener {
  private readonly logger = new Logger(SubscriberSyncListener.name);

  constructor(private readonly subscriberSync: SubscriberSyncService) {}

  @EventPattern('NOTIFICATION.user.*', {
    stream: 'NOTIFICATION',
    durable: 'notification-user-sync',
  })
  async handleSync(@Payload() event: UserSyncEvent, @Ctx() _ctx: JetStreamContext): Promise<void> {
    this.logger.log(`Syncing subscriber for user "${event.userId}"`);

    await this.subscriberSync.syncSubscriber({
      subscriberId: event.userId,
      email: event.email,
      phone: event.phone,
      firstName: event.firstName,
      lastName: event.lastName,
    });
  }
}
