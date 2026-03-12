import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import { type AuthSecurityEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { NotificationTriggerService } from '../services/notification-trigger.service';

@Injectable()
export class AuthListener implements OnModuleInit {
  private readonly logger = new Logger(AuthListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly triggerService: NotificationTriggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to auth security notification events');

    void subscribe<AuthSecurityEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.AUTH_SECURITY,
        durableName: 'notification-auth',
      },
      (payload, meta) => this.handleSecurity(payload, meta),
    );
  }

  /**
   * Auth security notifications are system-critical — no opt-out, no preference check.
   * Always delivered on all channels.
   */
  private async handleSecurity(event: AuthSecurityEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing auth security event "${event.eventType}" for user "${event.userId}"`,
    );

    await this.triggerService.trigger({
      workflowId: 'system-auth',
      to: { subscriberId: event.userId },
      payload: {
        eventType: event.eventType,
        metadata: event.metadata,
      },
      tenantId: event.tenantId ?? undefined,
    });
  }
}
