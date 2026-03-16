import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Novu } from '@novu/api';
import { createNovuClient, type SubscriberData } from '@roviq/notifications';

@Injectable()
export class SubscriberSyncService {
  private readonly logger = new Logger(SubscriberSyncService.name);
  private readonly novu: Novu;

  constructor(config: ConfigService) {
    this.novu = createNovuClient(config);
  }

  /**
   * Creates or updates a Novu subscriber. The `subscribers.create()` call is idempotent
   * — it upserts if the subscriberId already exists.
   * Subscriber ID = plain userId (Novu handles tenant isolation via context.tenant).
   */
  async syncSubscriber(data: SubscriberData): Promise<void> {
    this.logger.log(`Syncing subscriber "${data.subscriberId}"`);

    await this.novu.subscribers.create({
      subscriberId: data.subscriberId,
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      data: data.data,
    });
  }
}
