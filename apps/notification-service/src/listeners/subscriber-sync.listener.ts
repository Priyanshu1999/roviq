import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import { NOTIFICATION_SUBJECTS, type UserSyncEvent } from '@roviq/notifications';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { SubscriberSyncService } from '../services/subscriber-sync.service';

@Injectable()
export class SubscriberSyncListener implements OnModuleInit {
  private readonly logger = new Logger(SubscriberSyncListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly subscriberSync: SubscriberSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to user sync notification events');

    void subscribe<UserSyncEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.USER_CREATED,
        durableName: 'notification-user-sync',
      },
      (payload, meta) => this.handleSync(payload, meta),
    );

    void subscribe<UserSyncEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.USER_UPDATED,
        durableName: 'notification-user-sync',
      },
      (payload, meta) => this.handleSync(payload, meta),
    );
  }

  private async handleSync(event: UserSyncEvent, _meta: MessageMeta): Promise<void> {
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
